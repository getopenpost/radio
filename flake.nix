{
  description = "rgo-music: generative Strudel music library and the OpenPost Radio stream";

  outputs =
    { self }:
    {
      nixosModules.default = import ./nix/module.nix self;
    };
}
