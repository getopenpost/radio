{
  pkgs,
  lib,
  ...
}:

{
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
    npm = {
      enable = true;
      install.enable = true;
    };
  };

  packages = [
    pkgs.coreutils
    pkgs.ffmpeg
    pkgs.openssh
    pkgs.rclone
    pkgs.rsync
  ];

  # node-web-audio-api ships a prebuilt glibc binary that links libasound and libgcc_s.
  env = lib.optionalAttrs pkgs.stdenv.isLinux {
    LD_LIBRARY_PATH = lib.makeLibraryPath [
      pkgs.alsa-lib
      pkgs.stdenv.cc.cc.lib
    ];
  };

  enterShell = ''
    echo "rgo-music: npm run compose | render | library | stream | test (see README.md)"
  '';

  enterTest = ''
    npm test
  '';
}
