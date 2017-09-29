This is a hack to get one wire(temperature, humidity and wind speed) readings from Midon Design's Temp05(http://midondesign.com/Temp05/TEMP05.html) into a mongodb database.  This was done on a Raspberry Pi using a usb to serial cable(but eventually using a RS232/GPIO Shield with a female serial to female serial connector). Why Temp05?  I had it lying around the house and had used it previously with Homeseer(a windows based home automation program)

Unfortunately the Temp05 device is no longer available for purchase but you can purchase their newer device(Temp08) here -> http://midondesign.com/TEMP08/TEMP08.html.  It provides more support for other temperature related devices.

If you are a little more bold and want to pull the readings directly one wire devices you can take a look at this writeup(http://wannabe.guru.org/scott/hobbies/temperature).  The usb to one-wire dongle looks pretty nice and clean.

This project will use node with the npm modules cron, serialport, underscore, and mongodb.
