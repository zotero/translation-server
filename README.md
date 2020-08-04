# Zotero Translation Server

[![Build Status](https://travis-ci.com/zotero/translation-server.svg?branch=master)](https://travis-ci.com/zotero/translation-server)

The Zotero translation server lets you use [Zotero translators](https://www.zotero.org/support/translators) without the Zotero client.

## Installation

### Running via Docker

The easiest way to run a local instance of translation-server is via Docker.

```
docker pull zotero/translation-server
docker run -d -p 1969:1969 --rm --name translation-server zotero/translation-server
```

This will pull the latest image from Docker Hub and run it as a background process on port 1969. Use `docker kill translation-server` to stop it.

### Running from source

First, fetch the source code and install Node dependencies:

1. `git clone --recurse-submodules https://github.com/zotero/translation-server`

1. `cd translation-server`

1. `npm install`

Once you've set up a local copy of the repo, you can run the server in various ways:

#### Node.js

`npm start`

#### Docker (development)

Build from the local repo and run in foreground:

```
docker build -t translation-server .
docker run -ti -p 1969:1969 --rm translation-server
```

#### AWS Lambda

translation-server can also run on AWS Lambda and be accessed through API Gateway. You will need the [AWS SAM CLI](https://docs.aws.amazon.com/lambda/latest/dg/sam-cli-requirements.html) to deploy the server.

Copy and configure config file:
```
cp lambda_config.env-sample lambda_config.env
```

Test locally:
```
./lambda_local_test lambda_config.env
```

Deploy:
```
./lambda_deploy lambda_config.env
```

You can view the API Gateway endpoint in the Outputs section of the CloudFormation stack in the AWS Console.

## Proxy Support

You can configure `translation-server` to use a proxy server by setting the `HTTP_PROXY` and `HTTPS_PROXY` environment variables:

`HTTP_PROXY=http://proxy.example.com:8080 HTTPS_PROXY=http://proxy.example.com:8080 npm start`

If your proxy server uses a self-signed certificate, you can set `NODE_TLS_REJECT_UNAUTHORIZED=0` to force Node to ignore certificate errors.

It’s also possible to opt out of proxying for specific hosts by using the `NO_PROXY` variable. See the [Node `request` library documentation](https://github.com/request/request#controlling-proxy-behaviour-using-environment-variables) for more details.

## Running tests

`npm test`

## Endpoints

### Web Translation

#### Retrieve metadata for a webpage:

```
$ curl -d 'https://www.nytimes.com/2018/06/11/technology/net-neutrality-repeal.html' \
   -H 'Content-Type: text/plain' http://127.0.0.1:1969/web
```

Returns an array of translated items in Zotero API JSON format

#### Retrieve metadata for a webpage with multiple results:

```
$ curl -d 'https://www.ncbi.nlm.nih.gov/pubmed/?term=crispr' \
   -H 'Content-Type: text/plain' http://127.0.0.1:1969/web
```

Returns `300 Multiple Choices` with a JSON object:

```
{
	"url": "https://www.ncbi.nlm.nih.gov/pubmed/?term=crispr",
	"session": "9y5s0EW6m5GgLm0",
	"items": {
		"u30044970": {
			"title": "RNA Binding and HEPN-Nuclease Activation Are Decoupled in CRISPR-Cas13a."
		},
		"u30044923": {
			"title": "Knockout of tnni1b in zebrafish causes defects in atrioventricular valve development via the inhibition of the myocardial wnt signaling pathway."
		},
		// more results
	}
}
```

To make a selection, delete unwanted results from the items object and POST the returned data back to the server as `application/json`.


### Search Translation

Retrieve metadata from an identifier (DOI, ISBN, PMID, arXiv ID):

```
$ curl -d 10.2307/4486062 -H 'Content-Type: text/plain' http://127.0.0.1:1969/search
```

### Export Translation

Convert items in Zotero API JSON format to a [supported export format](https://github.com/zotero/translation-server/blob/master/src/formats.js) (RIS, BibTeX, etc.):

```
$ curl -d @items.json -H 'Content-Type: application/json' 'http://127.0.0.1:1969/export?format=bibtex'
```

### Import Translation

Convert items in any [import format](https://www.zotero.org/support/kb/importing_standardized_formats)
to the Zotero API JSON format:

```
$ curl --data-binary @data.bib -H 'Content-Type: text/plain' http://127.0.0.1:1969/import
