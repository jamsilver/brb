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
  console.log('Hello?');

  var usb = require('usb/usb.js');

  var the_button = usb.findByIds(DEVICE.ID.VENDOR, DEVICE.ID.PRODUCT);

  if (!the_button) {
    throw 'Big Red Button not found - make sure your Dream Cheeky button is plugged in to a USB port';
  }
  console.log('Hello?');

  the_button.open();
  var the_buttonInterface = the_button.interface(DEVICE.INTERFACE.NUM);
  if (the_buttonInterface.isKernelDriverActive()) {
    the_buttonInterface.detachKernelDriver();
  }
  console.log('Hello?');
  the_buttonInterface.claim();
  console.log('Hello?');
  process.on('exit', function() {
    the_button.close();
    the_buttonInterface.release();
  });
  console.log('Hello?');

  var controller = {};

  controller.listen = function() {
    var data = 0;
    the_button.timeout = DEVICE.REQ.TIMEOUT;

    //the_button.transfer(8, data, function(error, data) {
    the_button.controlTransfer(DEVICE.REQ.TYPE, DEVICE.REQ.REQ, DEVICE.REQ.VAL, 1, data, function(data) {
      console.log('Polling result is: ');
      console.log(data);
    });
    console.log('Hello:');
    console.log(data);
  }
  console.log('Hello?');

  controller.listen();

  module.exports = controller;
})();
