var ftpd    = require('ftp-server');
var fs      = require('fs');
var mocha   = require('mocha');
var should  = require('should');
var execSync = require('child_process').execSync;
var exec = require('child_process').exec;
var readline = require('readline-sync');

var isoPath = 'tambora-desktop-amd64.iso';

// Run the file transfer protocol on 2121
exec('python -m pyftpdlib -w 2121');

var preparation = function(option, cb){
  // Cleanup
  execSync('rm -f scenario');
  execSync('rm -f blankon-installer.log');
  // Prepare qemu image
  execSync('rm -f disk');
  execSync('qemu-img create -f raw disk 8G');
  // The scenario
  execSync(`echo "${option.scenario}" > scenario`);
  // Run qemu instance
  var headless = '';
  if (option.headless) {
    headless = '-nographic';
  }
  exec(`qemu-system-x86_64 ${headless} -cdrom ${isoPath} -drive file=disk,format=raw -m 2G -enable-kvm -net nic -net user`);
  timeout = false;
  timeoutTimer = setTimeout(function(){
    timeout = true;
  }, (1000 * 200000));
  // Check the timeout and report log for each 10 seconds
  intervalTimer = setInterval(function(){
    should.equal(-1, [1,2,3].indexOf(4));
    if (timeout) {
      console.log('Timeout');
      true.should.equal(false);
      // clear the timeout and interval
      clearTimeout(timeoutTimer);
      clearInterval(intervalTimer);
      // Killall the qemu instance
      execSync(`killall qemu-system-x86_64 > /dev/null`);
      done();
    } else {
      try {
      	fs.accessSync(__dirname + '/blankon-installer.log', fs.F_OK);
      	// Do something
        clearTimeout(timeoutTimer);
        clearInterval(intervalTimer);
        // Killall the qemu instance
        execSync(`killall qemu-system-x86_64 > /dev/null`);
        cb();
      } catch (e) {
      	// It isn't accessible
      }
    }
  }, 1000);
}
var timeout, timeoutTimer, intervalTimer;

describe('Legacy', function() {
  describe('Partition table : MBR', function() {
    it('Clean Installation', function(done) {
      preparation({
        scenario : 'LEGACY_MBR_CLEANINSTALL',
        headless : true,
        uefi : false
      }, function(){
        // Check the partition layout
        execSync(`cat blankon-installer.log | grep "Disklabel type: gpt" | cut -d':' -f2`).toString().should.equal(' gpt\n');
        execSync(`cat blankon-installer.log | grep "BIOS boot" | cut -d' ' -f1`).toString().should.equal('/dev/sda1\n');
        execSync(`cat blankon-installer.log | grep "Linux swap" | cut -d' ' -f1`).toString().should.equal('/dev/sda2\n');
        execSync(`cat blankon-installer.log | grep "Linux filesystem" | cut -d' ' -f1`).toString().should.equal('/dev/sda3\n');
        // Should has no physical sector boundary issue
        execSync(`cat blankon-installer.log | grep "does not start on physical sector boundary";echo $?`).toString().should.equal('1\n');
        done();
      })
    });
  });
});
