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
    pkgs.ffmpeg
    pkgs.rclone
  ];

  # node-web-audio-api ships a prebuilt glibc binary that links libasound and libgcc_s.
  env.LD_LIBRARY_PATH = lib.mkIf pkgs.stdenv.isLinux (
    lib.makeLibraryPath [
      pkgs.alsa-lib
      pkgs.stdenv.cc.cc.lib
    ]
  );

  enterShell = ''
    echo "rgo-music: npm run compose | render | build-library | stream (see README.md)"
  '';

  enterTest = ''
    npm test
  '';
}
