const { RippleAPI } = require('ripple-lib')
const { deriveAddress, deriveKeypair } = require('ripple-keypairs')
const { createSubmitter } = require('ilp-plugin-xrp-paychan-shared')
const BigNumber = require('bignumber.js')
const PluginPayment = require('ilp-plugin-payment')
const crypto = require('crypto')

class PluginXrpIou extends PluginPayment {
  constructor (opts) {
    super(opts)

    if (!opts.secret) {
      throw new Error('opts.secret must be defined')
    }

    // Parameters to connect to the network.
    this._secret = opts.secret
    this._address = opts.address || deriveAddress(deriveKeypair(opts.secret).publicKey)
    this._xrpServer = opts.xrpServer || 'wss://s1.ripple.com'
    this._api = new RippleAPI({ server: this._xrpServer })
    this._txSubmitter = createSubmitter(this._api, this._address, this._secret)

    if (typeof opts.assetScale !== 'number') {
      throw new Error('asset scale must be a number if specified.' +
        ' type=' + (typeof opts.assetScale) +
        ' value=' + opts.assetScale)
    }

    this._assetCode = opts.assetCode
    this._assetScale = (typeof opts.assetScale === 'number') ? opts.assetScale : 6
    this._assetSpread = opts.assetSpread || 1

    // This destination tag allows us to determine which payments are for us.
    // If we didn't have it, then a peer could send a payment to our address
    // and multiple plugins might register the incoming money. If you don't
    // have a mechanism to do this, then be very careful that multiple plugins
    // don't run on the same account
    this._destinationTagMap = new Map()
    this._userIdMap = new Map()
  }

  floatToBase (amount) {
    return new BigNumber(amount)
      .times(Math.pow(10, this._currencyScale))
      .toString()
  }

  baseToFloat (amount) {
    return new BigNumber(amount)
      .div(Math.pow(10, this._currencyScale))
      .toFixed(6, BigNumber.ROUND_UP)
  }

  async _userIdToDestinationTag (userId) {
    if (!this._destinationTagMap.get(userId)) {
      const tag = crypto.randomBytes(4).readUInt32BE(0)
      this._destinationTagMap.set(userId, tag)
      this._userIdMap.set(tag, userId)
    }
    return this._destinationTagMap.get(userId)
  }

  async _destinationTagToUserId (tag) {
    if (!this._userIdMap.get(tag)) {
      throw new Error('no user id found for tag. tag=' + tag)
    }
    return this._userIdMap.get(tag)
  }

  async connectPayment () {
    await this._api.connect()
    await this._api.connection.request({
      command: 'subscribe',
      accounts: [ this._address ]
    })

    // This is how we detect an incoming transaction. You'll need some equivalent of this
    // that calls this._handleMoney whenever a payment destined for this plugin comes in.
    this._api.connection.on('transaction', ev => {
      if (ev.validated && ev.transaction &&
        ev.transaction.TransactionType === 'Payment' &&
        ev.transaction.Destination === this._address &&
        ev.transaction.Amount.currency === this._assetCode) {
        const userId = this._destinationTagToUserId(ev.transaction.DestinationTag)
        const value = this.floatToBase(ev.transaction.Amount.value)
        this.emitAsync('money', userId, value)
      }
    })
  }

  // Return whatever details are needed in order to pay to this plugin's
  // account. They'll be returned when the other side calls
  // _getPaymentDetails()
  async getPaymentDetails (userId) {
    return {
      address: this._address,
      destinationTag: this._userIdToDestinationTag(userId)
    }
  }

  // Sends a payment. Details is the return value from getPaymentDetails for
  // the other side.
  async sendPayment (details, amount) {
    const floatAmount = this.baseToFloat(amount)
    const maxFloatAmount = new BigNumber(floatAmount)
      .times(1 + this._assetSpread)
      .toFixed(this._assetScale)

    await this._txSubmitter('preparePayment', {
      source: {
        address: this._address,
        maxAmount: {
          value: maxFloatAmount,
          currency: this._assetCode
        }
      },
      destination: {
        address: details.address,
        tag: details.destinationTag,
        amount: {
          value: floatAmount,
          currency: this._assetCode
        }
      }
    })
  }
}

module.exports = PluginXrpIou
