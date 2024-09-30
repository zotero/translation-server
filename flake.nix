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

        # Translation Server Version
        translationServerVersion = "c4f03e78e1c50dc61a2b8e5a452284581d9ad0e3"; # Specific commit for reproducibility
       
        translate = pkgs.fetchFromGitHub {
          owner = "zotero";
          repo = "translate";
          rev = "master";              # Specify the commit or branch
          sha256 = "sha256-dzkMnGEcFtJ3S10LtLVpq4d5O4f9+Jk12lrXhRegtPk=";
        };
        translators = pkgs.fetchFromGitHub {
          owner = "zotero";
          repo = "translators";
          rev = "master";              # Specify the commit or branch
          sha256 = "sha256-EH0DU/06pleNKv1A2/VIu+KZ85cpbRGSt3hqXUaEoLI=";
        };
        utilities = pkgs.fetchFromGitHub {
          owner = "zotero";
          repo = "utilities";
          rev = "master";              # Specify the commit or branch
          sha256 = "sha256-Pr6Htc1CdNubcZSt3ASwAYagJdPAbdA1a9RXyiqZSJY=";
        };
        zotero-schema = pkgs.fetchFromGitHub {
          owner = "zotero";
          repo = "zotero-schema";
          rev = "master";              # Specify the commit or branch
          sha256 = "sha256-P+4MXUD3ip3DceyUqMh+hgmHwaJqF0jUuuncliFdoYE=";
        };
      in {
        packages.default = pkgs.buildNpmPackage rec {
          pname = "zotero-translation-server";
          version = translationServerVersion;
         
          src = ./.;
          npmDepsHash = "sha256-JHoBxUybs1GGRxEVG5GgX2mOCplTgR5dcPjnR42SEbY=";
          makeCacheWritable = true;
	  dontNpmBuild = true;
         
	  postInstall = ''
	    modules="$out/lib/node_modules/translation-server/modules"
	    mkdir "$modules"
            ln -s ${translate} $modules/translate
            ln -s ${translators} $modules/translators
            ln -s ${utilities} $modules/utilities
            ln -s ${zotero-schema} $modules/zotero-schema
	  '';
         
          packageJson = "${src}/package.json";
         
          # Make the main script executable
          executable = true;
         
          meta = with pkgs.lib; {
            description = "Zotero Translation Server";
            homepage = "https://github.com/zotero/translation-server";
            license = licenses.mit;
            platforms = platforms.all;
          };
        };
        apps.default = flake-utils.lib.mkApp {
          drv = self.packages.${system}.default;
          name = "zotero-translation-server";
        };
      }
    );
}

