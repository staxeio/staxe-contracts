# Staxe Contracts 2.0

## Prerequisites

Recommended node version: Use the latest LTS version (currently v14.15.3).

Once you have cloned the Git repository into your local workspace, run

```shell
$ npm install
```

We recommend using [Visual Studio Code](https://code.visualstudio.com/) as Solidity IDE. Recommended extensions will be
shown when opening this project.

## Usage

Contracts are built, tested and deployed using [Hardhat](https://hardhat.org/).

**Clean local workspace:**

```shell
$ npx hardhat clean
```

**Compile contracts:**

```shell
$ npx hardhat compile
```

or

```shell
$ npm run contracts:compile
```

**Test contracts:**

```shell
$ npx hardhat test
```

or

```shell
$ npm run contracts:test
```

**Test with coverage:**

```shell
$ npx hardhat coverage
```

or

```shell
$ npm run contracts:coverage
```

This will produce a test report in the `coverage` folder. Open the `index.html` in a browser.
Also, it will instrument and compile contracts unoptimized, so you can ignore any contract size warnings.

## Testing

Tests present in the `test` folder make heavy usage of [Waffle](https://ethereum-waffle.readthedocs.io/en/latest).
Have a look at the [Chain matchers](https://ethereum-waffle.readthedocs.io/en/latest/matchers.html) for a useful set
of contract expection matchers.

### Security Reports

We recommend running [Slither](https://github.com/crytic/slither) using Docker (as installing Pything can easily end up in a mess when not done properly).
Pull following container into your local machine:

```shell
docker pull trailofbits/eth-security-toolbox
```

Enter the container with this repository mapped into a shared directory:

```shell
docker run -it -v [current dir]:/share trailofbits/eth-security-toolbox
```

and then run the reports with

```shell
cd /shared && slither .
```

The output will be stored in `artifacts/slither.json` for further usage.

## Deployments

To deploy to a network, a `secrets.json` file must be created. Use the `secrets.template.json` file, rename it and fill in the appropriate values.

Then deployments can be run with

```shell
$ npx hardhat run --network <network-name> scripts/deploy.ts
```

### Local deployments for development

Local development runs with a local hardhat network. The accounts have been created with the mnemonic:

```
throw ripple canoe glue typical soccer repeat enhance arch dolphin warm enough
```

This will give a predictable list of accounts which we can use to assign roles.

To deploy the contracts to the local network, run:

```shell
$ npx hardhat run --network localhost scripts/deploy-dev.ts
```

or shorter

```shell
$ npm run contracts:develop
```

This will print out the addresses of the deployed contracts.

Note that after changing the contracts, the ganache network should be reset in order to produce the same contract addresses again. This will make testing the frontend much simpler.

## Formatting

Source code can (and should) be formatted using prettier. To apply this, simply run

```shell
$ npx prettier --write .
```

or

```shell
$ npm run format
```

to re-format all source code. This works for both Typescript as well as Solidity files.

In a future improvement, this should be run as Git pre-commit hook.

### Formatting in VS Code

This requires the [VS Code Prettier Extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) to be installed.

Enabling `Format on Save` is the simplest way to keep the source code formatted according to prettier. This can be enabled
in `Settings > Text Editor > Formatting`:

- Enable the `Format On Save` checkbox

Make sure the default formatter is set to prettier.

- Search for the default formatter in `Settings > Text Editor`
- Change to `esbenp.prettier-vscode`

## Hardhat Extensions

Following extensions are installed:

- [Hardhat Contract Sizer](https://hardhat.org/plugins/hardhat-contract-sizer.html): Prints current contract sizes during compilation
- [Hardhat Gas Reporter](https://hardhat.org/plugins/hardhat-gas-reporter.html): Prints gas usage based on unit tests run
- [Hardhat Etherscan](https://hardhat.org/plugins/nomiclabs-hardhat-etherscan.html): Allows contract validation on Etherscan
