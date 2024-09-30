{ pkgs ? import <nixpkgs> {} }:

let
  nodePackages = import ./node-packages.nix;
  server = nodePackages.nodejs-18_x; # Adjust version as necessary
in
pkgs.stdenv.mkDerivation {
  pname = "zotero-translation-server";
  version = "1.0"; # Set your version here

  src = ./.;

  buildInputs = [ server ];

  installPhase = ''
    mkdir -p $out/bin
    cp -r src/* $out/bin/
    ln -s $out/bin/server.js $out/bin/zotero-translation-server
  '';
}
