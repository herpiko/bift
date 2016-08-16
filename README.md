## BIFT

Kependekan dari BlankOn Installer Functional Testing, perkakas untuk menguji fungsi pemasang terhadap beberapa skenario pemasangan.

#### Kebutuhan

- Berkas ISO dari `http://cdimage.blankonlinux.or.id/blankon/livedvd-harian/current/`. Letakkan pada direktori `bift`
- Paket `ovmf`, `socat` dan `qemu`
- Python module `pyftpdlib`, pasang dari `pip`.
- NodeJS minimal v5

#### Jalankan

- Pasang dependensi node, `npm install`
- Jalankan pengujian, `npm run test`

#### Bagaimana BIFT bekerja

Kode BlankOn Installer yang sekarnag (`blankon-installer` dan `blankon-installer-ui`) sudah dapat berinteraksi dengan protokol FTP dari `bift`, yang akan mengambil berkas skenario dari `ftp://10.0.2.2:2121/scenario` (alamat IP bawaan dari mesin induk di Qemu) dan akan dibawa ke `blankon-installer-ui` untuk digunakan sebagai variabel pemasangan. Pemasang BlankOn akan berjalan dengan variabel environment `DEBUG`, `AUTOFILL` dan `SCENARIO` yang akan mengotomatiskan proses pemasangan.

Skenario adalah sebuah berkas JSON yang memuat beberapa nilai pokok untuk digunakan sebagai parameter pemasangan, contoh :

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

Setelah pemasangan selesai, skrip paska pemasangan akan mengunggah catatan pemasangan ke induk Qemu dan `bift` akan memeriksanya.

#### License

MIT
