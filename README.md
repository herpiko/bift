## BIFT

BIFT is stand for BlankOn Installer Functional Testing.  A tool for testing the functionality of BlankOn Installer through some installation scenarios.

#### Requirements

- An ISO image file of `http://cdimage.blankonlinux.or.id/blankon/livedvd-harian/current/`. Put it in the `bift` direcotry.
- `socat`
- Python module `pyftpdlib`
- NodeJS
- Qemu

#### Run

- Install the node dependencies, `npm install`
- Run the test, `npm run test`

#### How it works

The current BlankOn Installer (`blankon-installer` and `blankon-installer-ui`) code base was included a pre script that fetch a scenario from `ftp://10.0.2.2:2121/scenario` (the default IP assigned to qemu host) and passing it to `blankon-instaler-ui`. The instaler will run with `DEBUG`, `AUTOFILL`, and `SCENARIO` environment variables that automate the installation process.

The `scenario` are a JSON file that represents the step that will be taken on installation.

```
{
  "partitionTable" : String,
  "data" : {
    "device" : Number,
    "device_path" : String,
    "partition" : Number,
    "cleanInstall" : Boolean,
    "advancedInstall" : Boolean,
    "partitionSteps" : Object
  }
}
```

Once the each installation complete, the post script will upload the installation logs to qemu host and BIFT will check at them.

#### License

MIT
