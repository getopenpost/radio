# NixOS module for the 24/7 stream. The streamer needs only Node and ffmpeg:
# tracks are rendered elsewhere and read from a library URL or directory.
self:
{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.services.rgo-music;
in
{
  options.services.rgo-music = {
    enable = lib.mkEnableOption "the OpenPost Radio music stream";

    rtmpUrlFiles = lib.mkOption {
      type = lib.types.nonEmptyListOf lib.types.path;
      example = lib.literalExpression ''[ config.sops.secrets.youtube-rtmp.path config.sops.secrets.twitch-rtmp.path ]'';
      description = ''
        Files each containing a full RTMP URL including the stream key (e.g. sops
        secrets), one per platform. The stream is encoded once and sent to all of
        them; a platform that drops reconnects without interrupting the others.
      '';
    };

    libraryUrl = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      example = "https://music.example.com/library";
      description = "Base URL serving catalog.json and tracks/*.flac. Tracks are cached just before they play.";
    };

    libraryDir = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      description = "Local library directory, used when libraryUrl is null.";
    };

    scale = lib.mkOption {
      type = lib.types.enum [
        2
        3
      ];
      default = 3;
      description = "Output size as a multiple of the 640x360 scene: 3 is 1080p, 2 is 720p at about half the CPU.";
    };

    fps = lib.mkOption {
      type = lib.types.int;
      default = 30;
    };

    preset = lib.mkOption {
      type = lib.types.str;
      default = "veryfast";
      description = "x264 preset.";
    };

    videoBitrate = lib.mkOption {
      type = lib.types.str;
      default = "4500k";
    };

    timezone = lib.mkOption {
      type = lib.types.str;
      default = "Europe/Lisbon";
      description = "Time zone that drives the scene's day and night.";
    };

    cpuWeight = lib.mkOption {
      type = lib.types.int;
      default = 200;
      description = "systemd CPUWeight; above the default 100 so other services cannot starve the stream.";
    };
  };

  config = lib.mkIf cfg.enable {
    assertions = [
      {
        assertion = cfg.libraryUrl != null || cfg.libraryDir != null;
        message = "services.rgo-music needs libraryUrl or libraryDir";
      }
    ];

    systemd.services.rgo-music = {
      description = "OpenPost Radio: 24/7 generative music stream";
      wantedBy = [ "multi-user.target" ];
      wants = [ "network-online.target" ];
      after = [ "network-online.target" ];
      path = [ pkgs.ffmpeg ];
      environment = {
        RGO_MUSIC_STATE = "/var/lib/rgo-music";
        RGO_MUSIC_SCALE = toString cfg.scale;
        RGO_MUSIC_FPS = toString cfg.fps;
        RGO_MUSIC_X264_PRESET = cfg.preset;
        RGO_MUSIC_VIDEO_BITRATE = cfg.videoBitrate;
        RGO_MUSIC_TIMEZONE = cfg.timezone;
      }
      // lib.optionalAttrs (cfg.libraryUrl != null) { RGO_MUSIC_LIBRARY_URL = cfg.libraryUrl; }
      // lib.optionalAttrs (cfg.libraryDir != null) { RGO_MUSIC_LIBRARY = cfg.libraryDir; };
      script = ''
        RGO_MUSIC_OUTPUTS=""
        for f in "$CREDENTIALS_DIRECTORY"/rtmp-*; do
          RGO_MUSIC_OUTPUTS="$RGO_MUSIC_OUTPUTS $(cat "$f")"
        done
        export RGO_MUSIC_OUTPUTS
        exec ${lib.getExe pkgs.nodejs_24} ${self}/src/stream/main.js
      '';
      serviceConfig = {
        LoadCredential = lib.imap0 (i: file: "rtmp-${toString i}:${file}") cfg.rtmpUrlFiles;
        DynamicUser = true;
        StateDirectory = "rgo-music";
        Restart = "always";
        RestartSec = 10;
        CPUWeight = cfg.cpuWeight;
        MemoryMax = "1G";
        ProtectSystem = "strict";
        ProtectHome = true;
        PrivateTmp = true;
        PrivateDevices = true;
        NoNewPrivileges = true;
        ProtectKernelTunables = true;
        ProtectControlGroups = true;
        RestrictNamespaces = true;
        LockPersonality = true;
      };
    };
  };
}
