// minicom -b 9600 -o -D /dev/ttyUSB0

// So the idea is to keep reading the data from the serial port data event into a buffer
// and then process the buffer on the close event
var emailSent = false;
var nodemailer = require('nodemailer');

function readOneWire(){
// test what comes back from Temp05
// var tstBuf = ">\nReading Sensors...\nHumidity #01[F7000000240B7026]=55%\nBarometer #01[83000000092B8E26]=29.98 inHg\nBarometer #02[520000001F568E26]=29.98 inHg\nVoltage #01[1299000088776626]= 02.23V 04.99V\nWind Dirn #01[D1F2000801340120]= WNW\nWind Speed[1AAB0000CDEF011D]=22 MPH, Gust =35\nLightning #01[8E0000000115111D]=00768\nTemp #01[600008001E316D10]=74.62F\nTemp #02[83000000092B8E26]=82.45F\nTemp #03[440000001EC34228]=73.50F\nTemp #04[83000000092B8E26]=82.45F\nTemp #05[EA00000040543910]=69.58F\nTemp #06[F7000000240B7026]=73.40F\nTemp #07[9200080046A89D10]=72.95F\n>";
// processTemp05Buffer(tstBuf);
// return;
  var ctr = 0;
  var readData = new Buffer(0);

  var SerialPort = require("serialport").SerialPort;
  var serialPort = new SerialPort("/dev/ttyUSB1", {
    baudrate: 9600
  }, false);

  serialPort.open(function () {
    serialPort.on('data', function(data) {
//      console.log('data received: ' + data);
      if(data === "\r"){
        data = "\n";
      }

      readData = Buffer.concat([readData, data]);
      // the first > is from the TMP command and the second is from the
      // last device reading so we close the port after get the second >
      if(data.toString().indexOf('>') !== -1){
        ctr++;
        if(ctr === 2){
          setTimeout(function(){serialPort.close();},100,null,null);
        }
      }
    });
    
    // once port is closed, process the buffer
    serialPort.on('close', function(err){
//      console.log(readData.toString());
      processTemp05Buffer(readData.toString());
    });

    // the TMP command tells the Temp05 to poll the one wire devices for temperature, humidity, wind speed
    serialPort.write("TMP\n", function(err, results) {
      if(err !== undefined){
        console.log('err ' + err);
      }
    });

    serialPort.on('error', function(err){
      if(err !== undefined){
        console.log('err ' + err);
      }
    });
  });

  // All this string mainpulation has to be improved
  function processTemp05Buffer(data){
    var items = data.split('\n');
    var len = items.length;
    for(var y=0; y < len; y++){
      if(items[y] === "\r" || items[y] === ">\r" || items[y] === "Reading Sensors...\r" || items[y] === ">"){
        continue;
      }
      else{
        processTemp05Readings(items[y]);
      }
    }
  }

  function processTemp05Readings(data){
    var idx1 = data.indexOf("[");
    var sub1 = data.substr(idx1);
//    console.log("idx1 - " + idx1);
//    console.log("sub1 - " + sub1);
    processTemp05Reading(sub1);
  }

  function processTemp05Reading(data){
//	console.log(data);
    var x = data.split("=");
    var key = x[0].replace("[", "").replace("]", "");
    if(x[1] === undefined){
	return;
    }
    var value = x[1].replace(/\r/g, "");
    var stat = {};
    stat.key = key;
    stat.value = value;
    stat.date = new Date();
   // console.log(stat);
    // gusts and lightning count are unique occurrences so they'll have a type of unknown
    if(value.indexOf("F") !== -1 || value.indexOf("C") !== -1){
      stat.type="temperature";
    } else if(value.indexOf("%") !== -1){
      stat.type="humidity";
    } else if(value.indexOf("inHg") !== -1){
      stat.type="pressure";
    } else if(value.indexOf("V") !== -1){
      stat.type="voltage";
    } else if(value.indexOf("MPH") !== -1){
      stat.type="windspeed";
    } else if(value.indexOf("N") !== -1 || value.indexOf("S") !== -1 || value.indexOf("E") !== -1 || value.indexOf("W") !== -1){
      stat.type="winddirection";
    } else{
      stat.type="unknown";
      return;
    }

    // Insert the record into mongolab db using their api for simplicity
    if(stat.key === "25000800383B4C10"){
      prevStat = getLastOutdoorTemp(function(lastStat){
         console.log("----------Current------------");
         console.log(stat);
         console.log("----------Previous------------");
         console.log(lastStat);

        var cur = parseInt(stat.value);
        var prev = parseInt(lastStat.value);
        
        if(cur <= 32){
          if(emailSent === false){
            sendEmail(false, stat, lastStat);
            emailSent = true;
          }
        }else{
          if(emailSent === true){
            sendEmail(true, stat, lastStat);
            emailSent = false;
          }
        }
      });
    }
    insertStat(stat);
  }

  function sendEmail(above, stat, prevStat){
    var smtpTransport = nodemailer.createTransport("SMTP", {
        service: "Gmail",
        auth: {
          user: "<gmail user>",
          pass: "<gmail password>"
        }
      });

      var subject = "";
      if(above){
        subject = "Temperature has risen above 32 degrees";
      }else{
        subject = "Temperature has dropped below 32 degrees";
      }

      var body = "The current temperature is: " + stat.value +". The previous temperature was: " + prevStat.value + ".";

    var mailOptions = {
        from: 'Pi Temp',
        to: "<to email address>",
        subject: subject,
        html: body
    };

    smtpTransport.sendMail(mailOptions, function(error, response){
        if(error){
            console.log(error);
        }else{
            console.log("Message sent: " + response.message);
        }

        smtpTransport.close();
    });
  }

  function insertStat(stat){
    var request = require('request');
    request(
      { method: 'POST',
      uri: '<mlab api>',
      headers: { 'content-type': 'application/json'},
      body: JSON.stringify(stat)
      },
      function (err, response, body) {
        if(err){
          console.log(err);
        }
      }
    );
  }

  function getLastOutdoorTemp(callback){
    var request = require('request');
    request(
      { method: 'GET',
      uri: '<mlab api>',
      headers: { 'content-type': 'application/json'}
      },
      function (err, response, body) {
        if(err){
          console.log(err);
        }
        callback(JSON.parse(body)[0]);
      }
    );

  }
}


var cronJob = require('cron').CronJob;
 
 // run every 5 minutes
var readJob = new cronJob({
     cronTime: '*/60 * * * * *',
     onTick: function () {
       readOneWire();
     },
     start: false
 });
 readJob.start();
