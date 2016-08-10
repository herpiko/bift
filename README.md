## BIFT

BIFT is stand for BlankOn Installer Functional Testing.  A tool for testing the functionality of BlankOn Installer through some installation scenarios.

#### Requirements

- Python module `pyftpdlib`
- NodeJS
- Qemu

#### Run

- Install the node dependencies, `npm install`
- Run the test, `npm run test`

#### How it works

The current BlankOn Installer (`blankon-installer` and `blankon-installer-ui`) code base was included a pre script that fetch a scenario from `ftp://10.0.2.2:2121/scenario` (the default IP assigned to qemu host) and passing it to `blankon-instaler-ui`. The instaler will run with `DEBUG`, `AUTOFILL`, and `SCENARIO` environment variables that automate the installation process.

A scenario string consists of three or more underscore separated word. The first word represent wether the system is a legacy BIOS or UEFI. The second string is the partition table type. The rest are the scenario detail. Example :

`LEGACY_MBR_CLEANINSTALL`

Once the each installation complete, the post script will upload the installation logs to qemu host and BIFT will check at them.

#### License

MIT
