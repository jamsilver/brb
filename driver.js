(function () {
  'use strict';

  /**
   * The following code has inspired this:
   *
   *  - https://github.com/derrick/dream_cheeky
   *  - https://github.com/pathikrit/node-thunder-driver
   *  - http://search.cpan.org/~bkendi/Device-USB-PanicButton-0.04/lib/Device/USB/PanicButton.pm
   */

  var DEVICE = {
    ID: {
      VENDOR : 0x1d34,
      PRODUCT: 0x000d
    },

    STATE: {
      CLOSED: 0x15,
      OPEN: 0x17,
      DEPRESSED: 0x16
    },

    REQ: {
      TYPE: 0xA1,
      REQ: 0x1,
      VAL: 0x300,
      //SIZE: 8,
      TIMEOUT: 5
    },

    INTERFACE: {
      NUM: 0
    }
  };

  var util = require('util');
  var events = require('events');
  var HID = require('node-hid');

  function BigRedButtonController(index)
  {
    if (!arguments.length) {
      index = 0;
    }

    var controllers = HID.devices(DEVICE.ID.VENDOR, DEVICE.ID.PRODUCT);

    console.log(controllers);

    if (!controllers.length) {
      throw new Error("No BigRedButton controllers could be found");
    }

    if (index > controllers.length || index < 0) {
      throw new Error("Index " + index + " out of range, only " + controllers.length + " BigRedButton controllers found");
    }

    events.EventEmitter.call(this);

    console.log(controllers[index].path);
    this.hid = new HID.HID(controllers[index].path);

    // Start reading.
    //this.hid.read(this.buzzerData.bind(this));
    this.hid.read(function(error, data){
      console.log(error);
      console.log(data);
    })
  }

  util.inherits(BigRedButtonController, events.EventEmitter);

  BigRedButtonController.prototype.handleBuzzer = function (buzzerNumber, bits)
  {
    var mask = 1 << (buzzerNumber * 5);
    for (var buttonNumber = 0; buttonNumber < 5; buttonNumber++) {
      var now = bits & mask;
      var old = this.oldBits & mask;
      if (old ^ now) {
        this.emit('button', buzzerNumber, buttonNumber, now ? true : false);
      }
      mask <<= 1;
    }
  }

  BigRedButtonController.prototype.buzzerData = function (error, data) {
    console.log(data);
    this.oldBits = bits;

  }

  module.exports = BigRedButtonController;
})();
