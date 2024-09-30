{
  description = "Nix flake to set up Zotero Translation Server.";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        packages.default = pkgs.callPackage ./default.nix {};
        apps.default = flake-utils.lib.mkApp {
          drv = self.packages.${system}.default;
          checkPhase = "true";
          name = "zotero-translation-server";
        };
      }
    );
}

