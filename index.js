var ftpd    = require('ftp-server');
var fs      = require('fs');
var mocha   = require('mocha');
var should  = require('should');
var execSync = require('child_process').execSync;
var exec = require('child_process').exec;
var readline = require('readline-sync');

var isoPath = 'tambora-desktop-amd64.iso';
isoPath = '/home/herpiko/livecdtmp/modifikasi.iso';

// Run the file transfer protocol on 2121
exec('python -m pyftpdlib -w 2121');

var preparation = function(option, cb){
  // Cleanup
  execSync('rm -f scenario');
  execSync('rm -f blankon-installer.log');
  // Prepare qemu image
  if (!option.keepDisk) {
    execSync('rm -f disk');
    execSync('qemu-img create -f raw disk 8G');
  } else {
    console.log('Use previous disk state.');
  }
  if (option.scenario.partitionTable === 'mbr') {
    console.log('Wipe disk to MBR');
    execSync('(echo o;echo w) | /sbin/fdisk disk');
  } else if (option.scenario.partitionTable === 'gpt') {
    console.log('Wipe disk to GPT');
    execSync('(echo g;echo w) | /sbin/fdisk disk');
  }
  // The scenario
  execSync(`echo "${JSON.stringify(JSON.stringify(option.scenario))}" > scenario`);
  // Run qemu instance
  var headless = '';
  if (option.headless) {
    headless = '-nographic';
  }
  exec(`qemu-system-x86_64 ${headless} -boot d -cdrom ${isoPath} -drive file=disk,format=raw -m 2G -enable-kvm -net nic -net user -monitor unix:${__dirname}/monitor,server,nowait`);
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
      execSync(`echo system_powerdown | socat - UNIX-CONNECT:monitor`);
      setTimeout(function(){
        cb();
      }, 5000)
    } else {
      try {
      	fs.accessSync(__dirname + '/blankon-installer.log', fs.F_OK);
      	// Do something
        clearTimeout(timeoutTimer);
        clearInterval(intervalTimer);
        // Killall the qemu instance
        execSync(`echo system_powerdown | socat - UNIX-CONNECT:monitor`);
        setTimeout(function(){
          cb();
        }, 5000)
      } catch (e) {
      	// It isn't accessible. Do nothing.
      }
    }
  }, 1000);
}
var timeout, timeoutTimer, intervalTimer;

describe('Legacy', function() {
  describe('Partition table : MBR', function() {
    it('Clean Installation', function(done) {
      var scenario = {
        partitionTable : 'mbr',
        data : {
          cleanInstall : true,
          device : 0,
          device_path : '/dev/sda',
        }
      }
      preparation({
        scenario : scenario,
        headless : false,
        uefi : false
      }, function(){
        console.log('Installation complete.');
        // Check the partition layout
        execSync('/sbin/fdisk -l disk');
        execSync(`/sbin/fdisk -l disk | grep "Disklabel type: gpt" | cut -d':' -f2`).toString().should.equal(' gpt\n');
        execSync(`/sbin/fdisk -l disk | grep "BIOS boot" | cut -d' ' -f1`).toString().should.equal('disk1\n');
        execSync(`/sbin/fdisk -l disk | grep "Linux swap" | cut -d' ' -f1`).toString().should.equal('disk2\n');
        execSync(`/sbin/fdisk -l disk | grep "Linux filesystem" | cut -d' ' -f1`).toString().should.equal('disk3\n');
        // Should has no physical sector boundary issue
        execSync(`cat blankon-installer.log | grep "does not start on physical sector boundary";echo $?`).toString().should.equal('1\n');
        done();
      })
    });
    it('Install to empty disk', function(done) {
      var scenario = {
        partitionTable : 'mbr',
        data : {
          device : 0,
          device_path : '/dev/sda',
          partition : 0,
        }
      }
      preparation({
        scenario : scenario,
        headless : false,
        uefi : false,
      }, function(){
        console.log('Installation complete.');
        // Check the partition layout
        execSync('/sbin/fdisk -l disk');
        execSync(`/sbin/fdisk -l disk | grep "Disklabel type: dos" | cut -d':' -f2`).toString().should.equal(' dos\n');
        execSync(`/sbin/fdisk -l disk | grep "Extended" | cut -d' ' -f1`).toString().should.equal('disk1\n');
        execSync(`/sbin/fdisk -l disk | grep "82 Linux swap" | cut -d' ' -f1`).toString().should.equal('disk5\n');
        execSync(`/sbin/fdisk -l disk | grep "83 Linux" | cut -d' ' -f1`).toString().should.equal('disk6\n');
        // Should has no physical sector boundary issue
        execSync(`cat blankon-installer.log | grep "does not start on physical sector boundary";echo $?`).toString().should.equal('1\n');
        done();
      })
    });
    it('Existing BlankOn system. Reinstall the root partition.', function(done) {
      var scenario = {
        data : {
          device : 0,
          device_path : '/dev/sda',
          partition : 6,
        }
      }
      preparation({
        scenario : scenario,
        headless : false,
        uefi : false,
        keepDisk : true
      }, function(){
        console.log('Installation complete.');
        // Check the partition layout
        execSync('/sbin/fdisk -l disk');
        execSync(`/sbin/fdisk -l disk | grep "Disklabel type: dos" | cut -d':' -f2`).toString().should.equal(' dos\n');
        execSync(`/sbin/fdisk -l disk | grep "Extended" | cut -d' ' -f1`).toString().should.equal('disk1\n');
        execSync(`/sbin/fdisk -l disk | grep "82 Linux swap" | cut -d' ' -f1`).toString().should.equal('disk5\n');
        execSync(`/sbin/fdisk -l disk | grep "83 Linux" | cut -d' ' -f1`).toString().should.equal('disk6\n');
        // Should has no physical sector boundary issue
        execSync(`cat blankon-installer.log | grep "does not start on physical sector boundary";echo $?`).toString().should.equal('1\n');
        done();
      })
    });
  });
  describe('Partition table : GPT', function() {
    it('Clean Installation', function(done) {
      var scenario = {
        partitionTable : 'gpt',
        data : {
          cleanInstall : true,
          device : 0,
          device_path : '/dev/sda',
        }
      }
      preparation({
        scenario : scenario,
        headless : false,
        uefi : false
      }, function(){
        console.log('Installation complete.');
        // Check the partition layout
        execSync('/sbin/fdisk -l disk');
        execSync(`/sbin/fdisk -l disk | grep "Disklabel type: gpt" | cut -d':' -f2`).toString().should.equal(' gpt\n');
        execSync(`/sbin/fdisk -l disk | grep "BIOS boot" | cut -d' ' -f1`).toString().should.equal('disk1\n');
        execSync(`/sbin/fdisk -l disk | grep "Linux swap" | cut -d' ' -f1`).toString().should.equal('disk2\n');
        execSync(`/sbin/fdisk -l disk | grep "Linux filesystem" | cut -d' ' -f1`).toString().should.equal('disk3\n');
        // Should has no physical sector boundary issue
        execSync(`cat blankon-installer.log | grep "does not start on physical sector boundary";echo $?`).toString().should.equal('1\n');
        done();
      })
    });
  });
});
