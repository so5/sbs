# [2.3.0](https://github.com/so5/sbs/compare/v2.2.0...v2.3.0) (2026-07-18)


### Bug Fixes

* fall back to package.json diff when dependabot update-type is null ([24da66c](https://github.com/so5/sbs/commit/24da66c8e454e57a3f655df17451c3c39e2ee312))
* match dependabot/snyk bot logins as reported by gh pr list --json ([042ee2d](https://github.com/so5/sbs/commit/042ee2d53929b2468687d9d41871bcbb97966a0a))
* proactively update PR branch before enabling auto-merge ([a836c41](https://github.com/so5/sbs/commit/a836c418440b6a490330f6b0a3c137f8f73c9636))
* use admin PAT for release checkout so branch protection doesn't block it ([52e8bfe](https://github.com/so5/sbs/commit/52e8bfeb7c096c2737f2deb3c8d22d049de49ead))


### Features

* auto-approve and auto-merge patch/minor bot dependency PRs ([5ea21c1](https://github.com/so5/sbs/commit/5ea21c1ee0681235bd56c16e093460a3b4dc244a))
* include package/version details in Slack major-update notice ([331c74e](https://github.com/so5/sbs/commit/331c74ec6b837e49c756650a5a326b5ad9353a3a))
* periodically unstick behind bot PRs with auto-merge enabled ([c7b397f](https://github.com/so5/sbs/commit/c7b397fb453c8b53d57fcf10e92452fb4f859db6))

# [2.2.0](https://github.com/so5/sbs/compare/v2.1.0...v2.2.0) (2026-07-18)


### Bug Fixes

* correct semantic-release branches config to master ([0272a70](https://github.com/so5/sbs/commit/0272a7053483518534320423bdfde19ccf443b1c))
* upgrade debug from 4.4.1 to 4.4.3 ([#56](https://github.com/so5/sbs/issues/56)) ([710d75f](https://github.com/so5/sbs/commit/710d75f84700c533b048d3437be5f5a91891ed4a))


### Features

* Add TypeScript type definitions ([#57](https://github.com/so5/sbs/issues/57)) ([2424f6f](https://github.com/so5/sbs/commit/2424f6f7c4b050cfac4488053106a4798505f601))
* Separate Code Climate and npm publish workflows ([#58](https://github.com/so5/sbs/issues/58)) ([027ff47](https://github.com/so5/sbs/commit/027ff47c630b3be5b4046d20ab82f17c9788b3c3))
* setup github actions for semantic release, deploy and coverage reporting ([#53](https://github.com/so5/sbs/issues/53)) ([99dcffc](https://github.com/so5/sbs/commit/99dcffc553936ba5986a5f6b358d8ed1441a36a5))
