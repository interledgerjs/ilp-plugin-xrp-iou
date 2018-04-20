# ILP Plugin XRP IOU
> ILP plugin for XRP Ledger which settles via IOUs

- [Overview](#overview)
- [Usage](#usage)

## Overview

Previous ILP Plugins for XRP Ledger have been based on payment channels, which
means they can only use XRP.

This plugin is in the non-payment-channel class of plugins, based upon the [ILP
Plugin Payment](https://github.com/interledgerjs/ilp-plugin-payment) skeleton.
Every call to `sendMoney` triggers an actual on-ledger payment.

Because of the low fees and the speed of XRP Ledger, this is a viable strategy
for settlement, and maximum unsecured amounts can still be kept low.
Furthermore, sending on-ledger payments means we can use any asset issued on
the XRP ledger to settle, not just XRP.

## Usage

Add `ilp-plugin-xrp-iou` to your project with:

```
npm install --save ilp-plugin-xrp-iou
```

Then you can construct the plugin like so:

```js
const PluginXrpIou = require('ilp-plugin-xrp-iou')
const plugin = new PluginXrpIou({
  address: 'r...',            // Address on XRP ledger
  secret: 's...',             // Secret on XRP ledger
  server: 'btp+wss://...',    // BTP server of peer, or listener object
  assetCode: 'USD',           // Asset code for IOU
  assetScale: '9',            // Scale to use for integers in the given asset type
  assetSpread: '0.01'         // Maximum fee on a payment from USD->USD
})
```
