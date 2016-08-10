var ftpd    = require('ftp-server');
var fs      = require('fs');
var mocha   = require('mocha');
var should  = require('should');
var execSync = require('child_process').execSync;
var exec = require('child_process').exec;
var readline = require('readline-sync');

var isoPath = '/home/herpiko/Downloads/iso/tambora-desktop-amd64.iso';

// Run the file transfer protocol on 2121
ftpd.fsOptions.root = __dirname + '/';
ftpd.listen(2121);

describe('Legacy', function() {
  describe('Partition table : MBR', function() {
    it('Clean Installation', function(done) {
      // Prepare qemu image
      execSync('rm -f disk');
      execSync('qemu-img create -f raw disk 8G');
      // The scenario
      execSync('echo "LEGACY_MBR_CLEANINSTALL" > scenario');
      // Run qemu instance
      exec(`qemu-system-x86_64 -cdrom ${isoPath} -drive file=disk,format=raw -m 2G -enable-kvm -net nic -net user`);
      var timeout = false;
      var timeoutTimer = setTimeout(function(){
        timeout = true;
      }, (1000 * 20));
      // Check the timeout and report log for each 10 seconds
      var intervalTimer = setInterval(function(){
        should.equal(-1, [1,2,3].indexOf(4));
        console.log(timeout);
        if (timeout) {
          // Killal lthe qemu instance
          execSync(`killall qemu-system-x86_64`);
          console.log('Timeout');
          true.should.equal(false);
          // clear the timeout and interval
          clearTimeout(timeoutTimer);
          clearInterval(intervalTimer);
          done();
        } else {
          // Check for the log files
          done();
        }
      }, 1000)
    });
  });
});
