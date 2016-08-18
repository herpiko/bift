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
  if (!option.keepDisk) {
    execSync('rm -f disk*');
    execSync('qemu-img create -f raw disk0 8G');
  } else {
    console.log('Use previous disk state.');
  }
  if (!option.disks || (option.disks && option.disks.length === 1)) {
    if (option.partitionTable === 'mbr') {
      console.log('Wipe disk to MBR');
      execSync('(echo o;echo w) | /sbin/fdisk disk0');
    } else if (option.partitionTable === 'gpt') {
      console.log('Wipe disk to GPT');
      execSync('(echo g;echo w) | /sbin/fdisk disk0');
    }
  }
  var disks = '';
  if (option.disks && option.disks.length > 0) {
    for (var i in option.disks) {
      if (option.disks[i].fdisk) {
        try {
      	  fs.accessSync(__dirname + '/disk' + i, fs.F_OK);
        } catch(e) {
          execSync(`qemu-img create -f raw disk${i} 8G`);
        }
        execSync(option.disks[i].fdisk);
        if (i > 0) {
          disks += `-drive file=disk${i},format=raw`;
        }
      }
    }
  }
  // The scenario
  execSync(`echo "${JSON.stringify(JSON.stringify(option.scenario))}" > scenario`);
  // Run qemu instance
  var uefi = '';
  if (option.uefi) {
    uefi = '-bios /usr/share/qemu/OVMF.fd';
  }
  var headless = '';
  if (option.headless) {
    headless = '-nographic';
  }
  var qemu = `qemu-system-x86_64 -nodefaults -boot d -cdrom ${isoPath} -drive file=disk0,format=raw ${disks} -m 2G -enable-kvm -net nic -net user -monitor unix:${__dirname}/monitor,server,nowait -serial vc -vga virtio ${uefi} ${headless}`;
  console.log(qemu);
  exec(qemu);
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
      	fs.accessSync(__dirname + '/blankon-installer.parted.log', fs.F_OK);
      	// Do something
        clearTimeout(timeoutTimer);
        clearInterval(intervalTimer);
        // Killall the qemu instance
        execSync(`echo system_powerdown | socat - UNIX-CONNECT:monitor`);
        setTimeout(function(){
          console.log('Installation complete.');
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
        data : {
          cleanInstall : true,
          device : 0,
          device_path : '/dev/sda',
        }
      }
      preparation({
        partitionTable : 'mbr',
        scenario : scenario,
        headless : false,
        uefi : false
      }, function(){
        // Check the partition layout
        execSync('/sbin/fdisk -l disk0');
        execSync(`/sbin/fdisk -l disk0 | grep "Disklabel type: gpt" | cut -d':' -f2`).toString().should.equal(' gpt\n');
        execSync(`/sbin/fdisk -l disk0 | grep "BIOS boot" | cut -d' ' -f1`).toString().should.equal('disk0p1\n');
        execSync(`/sbin/fdisk -l disk0 | grep "Linux swap" | cut -d' ' -f1`).toString().should.equal('disk0p2\n');
        execSync(`/sbin/fdisk -l disk0 | grep "Linux filesystem" | cut -d' ' -f1`).toString().should.equal('disk0p3\n');
        // Should has no physical sector boundary issue
        execSync(`cat blankon-installer.log | grep "does not start on physical sector boundary";echo $?`).toString().should.equal('1\n');
        done();
      })
    });
    it('Install to empty disk', function(done) {
      var scenario = {
        data : {
          device : 0,
          device_path : '/dev/sda',
          partition : 0,
        }
      }
      preparation({
        partitionTable : 'mbr',
        scenario : scenario,
        headless : false,
        uefi : false,
      }, function(){
        // Check the partition layout
        execSync('/sbin/fdisk -l disk0');
        execSync(`/sbin/fdisk -l disk0 | grep "Disklabel type: dos" | cut -d':' -f2`).toString().should.equal(' dos\n');
        execSync(`/sbin/fdisk -l disk0 | grep "Extended" | cut -d' ' -f1`).toString().should.equal('disk0p1\n');
        execSync(`/sbin/fdisk -l disk0 | grep "82 Linux swap" | cut -d' ' -f1`).toString().should.equal('disk0p5\n');
        execSync(`/sbin/fdisk -l disk0 | grep "83 Linux" | cut -d' ' -f1`).toString().should.equal('disk0p6\n');
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
        // Check the partition layout
        execSync('/sbin/fdisk -l disk0');
        execSync(`/sbin/fdisk -l disk0 | grep "Disklabel type: dos" | cut -d':' -f2`).toString().should.equal(' dos\n');
        execSync(`/sbin/fdisk -l disk0 | grep "Extended" | cut -d' ' -f1`).toString().should.equal('disk0p1\n');
        execSync(`/sbin/fdisk -l disk0 | grep "82 Linux swap" | cut -d' ' -f1`).toString().should.equal('disk0p5\n');
        execSync(`/sbin/fdisk -l disk0 | grep "83 Linux" | cut -d' ' -f1`).toString().should.equal('disk0p6\n');
        // Should has no physical sector boundary issue
        execSync(`cat blankon-installer.log | grep "does not start on physical sector boundary";echo $?`).toString().should.equal('1\n');
        done();
      })
    });
    it('Install to an existing logical partition', function(done) {
      // Skenario Uji Installer #5 : Simple Mode, Disk label msdos, terisi tiga partisi primary, pasang pada extended/logical
      // http://dev.blankonlinux.or.id/ticket/1482
      var scenario = {
        data : {
          device : 0,
          device_path : '/dev/sda',
          partition : 7,
        }
      }
      preparation({
        partitionTable : 'mbr',
        scenario : scenario,
        headless : false,
        uefi : false,
        disks : [
          {fdisk : '(echo o;echo n;echo p;echo 1;echo "";echo 1M;echo n;echo p;echo 2;echo "";echo 2M;echo n;echo e;echo 3;echo "";echo "";echo w;) | /sbin/fdisk disk0'}
        ]
      }, function(){
        // Check the partition layout
        execSync('/sbin/fdisk -l disk0');
        execSync(`/sbin/fdisk -l disk0 | grep "Disklabel type: dos" | cut -d':' -f2`).toString().should.equal(' dos\n');
        execSync(`/sbin/fdisk -l disk0 | grep "1048576" | cut -d' ' -f1`).toString().should.equal('disk0p1\n');
        execSync(`/sbin/fdisk -l disk0 | grep "2097152" | cut -d' ' -f1`).toString().should.equal('disk0p2\n');
        execSync(`/sbin/fdisk -l disk0 | grep "Extended" | cut -d' ' -f1`).toString().should.equal('disk0p3\n');
        execSync(`/sbin/fdisk -l disk0 | grep "82 Linux swap" | cut -d' ' -f1`).toString().should.equal('disk0p5\n');
        execSync(`/sbin/fdisk -l disk0 | grep "12578832" | cut -d' ' -f1`).toString().should.equal('disk0p6\n');
        // Should has no physical sector boundary issue
        execSync(`cat blankon-installer.log | grep "does not start on physical sector boundary";echo $?`).toString().should.equal('1\n');
        done();
      })
    });
    it('Install to second drive, empty', function(done) {
      // Skenario Uji Installer #9 : Simple Mode, Harddisk kedua, Disk label msdos, terisi satu partisi primary
      // http://dev.blankonlinux.or.id/ticket/1485
      var scenario = {
        data : {
          device : 1,
          device_path : '/dev/sdb',
          partition : 0,
        }
      }
      preparation({
        partitionTable : 'mbr',
        scenario : scenario,
        headless : false,
        uefi : false,
        disks : [
          {fdisk : '(echo o;echo w;) | /sbin/fdisk disk0'},
          {fdisk : '(echo o;echo w;) | /sbin/fdisk disk1'},
        ]
      }, function(){
        // Check the partition layout
        execSync('/sbin/fdisk -l disk1');
        execSync(`/sbin/fdisk -l disk1 | grep "Disklabel type: dos" | cut -d':' -f2`).toString().should.equal(' dos\n');
        execSync(`/sbin/fdisk -l disk1 | grep "Extended" | cut -d' ' -f1`).toString().should.equal('disk1p1\n');
        execSync(`/sbin/fdisk -l disk1 | grep "82 Linux swap" | cut -d' ' -f1`).toString().should.equal('disk1p5\n');
        execSync(`/sbin/fdisk -l disk1 | grep "83 Linux" | cut -d' ' -f1`).toString().should.equal('disk1p6\n');
        // Should has no physical sector boundary issue
        execSync(`cat blankon-installer.log | grep "does not start on physical sector boundary";echo $?`).toString().should.equal('1\n');
        done();
      })
    });
  });
  describe('Partition table : GPT', function() {
    it('Clean Installation', function(done) {
      var scenario = {
        data : {
          cleanInstall : true,
          device : 0,
          device_path : '/dev/sda',
        }
      }
      preparation({
        partitionTable : 'gpt',
        scenario : scenario,
        headless : false,
        uefi : false
      }, function(){
        // Check the partition layout
        execSync('/sbin/fdisk -l disk0');
        execSync(`/sbin/fdisk -l disk0 | grep "Disklabel type: gpt" | cut -d':' -f2`).toString().should.equal(' gpt\n');
        execSync(`/sbin/fdisk -l disk0 | grep "BIOS boot" | cut -d' ' -f1`).toString().should.equal('disk0p1\n');
        execSync(`/sbin/fdisk -l disk0 | grep "Linux swap" | cut -d' ' -f1`).toString().should.equal('disk0p2\n');
        execSync(`/sbin/fdisk -l disk0 | grep "Linux filesystem" | cut -d' ' -f1`).toString().should.equal('disk0p3\n');
        // Should has no physical sector boundary issue
        execSync(`cat blankon-installer.log | grep "does not start on physical sector boundary";echo $?`).toString().should.equal('1\n');
        done();
      })
    });
    it('Install on empty disk', function(done) {
      // Skenario Uji Installer #10 : Simple Mode, tanpa Disk label, kosong
      // http://dev.blankonlinux.or.id/ticket/1498
      var scenario = {
        data : {
          partition : 0,
          device : 0,
          device_path : '/dev/sda',
        }
      }
      preparation({
        partitionTable : 'gpt',
        scenario : scenario,
        headless : false,
        uefi : false
      }, function(){
        // Check the partition layout
        execSync('/sbin/fdisk -l disk0');
        execSync(`/sbin/fdisk -l disk0 | grep "Disklabel type: gpt" | cut -d':' -f2`).toString().should.equal(' gpt\n');
        execSync(`/sbin/fdisk -l disk0 | grep "BIOS boot" | cut -d' ' -f1`).toString().should.equal('disk0p1\n');
        execSync(`/sbin/fdisk -l disk0 | grep "Linux swap" | cut -d' ' -f1`).toString().should.equal('disk0p2\n');
        execSync(`/sbin/fdisk -l disk0 | grep "Linux filesystem" | cut -d' ' -f1`).toString().should.equal('disk0p3\n');
        // Should has no physical sector boundary issue
        execSync(`cat blankon-installer.log | grep "does not start on physical sector boundary";echo $?`).toString().should.equal('1\n');
        done();
      })
    });
  });
});
describe.skip('UEFI', function() {
  describe('Partition table : MBR', function() {
    it('Clean Installation', function(done) {
      var scenario = {
        data : {
          cleanInstall : true,
          device : 0,
          device_path : '/dev/sda',
        }
      }
      preparation({
        partitionTable : 'mbr',
        scenario : scenario,
        headless : false,
        uefi : true
      }, function(){
        // Check the partition layout
        execSync('/sbin/fdisk -l disk0');
        execSync(`/sbin/fdisk -l disk0 | grep "Disklabel type: gpt" | cut -d':' -f2`).toString().should.equal(' gpt\n');
        execSync(`/sbin/fdisk -l disk0 | grep "EFI System" | cut -d' ' -f1`).toString().should.equal('disk0p1\n');
        execSync(`/sbin/fdisk -l disk0 | grep "Linux swap" | cut -d' ' -f1`).toString().should.equal('disk0p2\n');
        execSync(`/sbin/fdisk -l disk0 | grep "Linux filesystem" | cut -d' ' -f1`).toString().should.equal('disk0p3\n');
        // Should has no physical sector boundary issue
        execSync(`cat blankon-installer.log | grep "does not start on physical sector boundary";echo $?`).toString().should.equal('1\n');
        done();
      })
    });
  });
  describe('Partition table : GPT', function() {
    it('Clean Installation', function(done) {
      var scenario = {
        data : {
          cleanInstall : true,
          device : 0,
          device_path : '/dev/sda',
        }
      }
      preparation({
        partitionTable : 'gpt',
        scenario : scenario,
        headless : false,
        uefi : true
      }, function(){
        // Check the partition layout
        execSync('/sbin/fdisk -l disk0');
        execSync(`/sbin/fdisk -l disk0 | grep "Disklabel type: gpt" | cut -d':' -f2`).toString().should.equal(' gpt\n');
        execSync(`/sbin/fdisk -l disk0 | grep "EFI System" | cut -d' ' -f1`).toString().should.equal('disk0p1\n');
        execSync(`/sbin/fdisk -l disk0 | grep "Linux swap" | cut -d' ' -f1`).toString().should.equal('disk0p2\n');
        execSync(`/sbin/fdisk -l disk0 | grep "Linux filesystem" | cut -d' ' -f1`).toString().should.equal('disk0p3\n');
        // Should has no physical sector boundary issue
        execSync(`cat blankon-installer.log | grep "does not start on physical sector boundary";echo $?`).toString().should.equal('1\n');
        done();
      })
    });
    it('Install to empty disk', function(done) {
      var scenario = {
        data : {
          device : 0,
          device_path : '/dev/sda',
          partition : 0,
        }
      }
      preparation({
        partitionTable : 'gpt',
        scenario : scenario,
        headless : false,
        uefi : true
      }, function(){
        // Check the partition layout
        execSync('/sbin/fdisk -l disk0');
        execSync(`/sbin/fdisk -l disk0 | grep "Disklabel type: gpt" | cut -d':' -f2`).toString().should.equal(' gpt\n');
        execSync(`/sbin/fdisk -l disk0 | grep "EFI System" | cut -d' ' -f1`).toString().should.equal('disk0p1\n');
        execSync(`/sbin/fdisk -l disk0 | grep "Linux swap" | cut -d' ' -f1`).toString().should.equal('disk0p2\n');
        execSync(`/sbin/fdisk -l disk0 | grep "Linux filesystem" | cut -d' ' -f1`).toString().should.equal('disk0p3\n');
        // Should has no physical sector boundary issue
        execSync(`cat blankon-installer.log | grep "does not start on physical sector boundary";echo $?`).toString().should.equal('1\n');
        done();
      })
    });
  });
});
