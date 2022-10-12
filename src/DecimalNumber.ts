import { BigNumber, BigNumberish, constants, utils } from "ethers";

export const mulDivUp = (x: BigNumberish, y: BigNumberish, scale: BigNumberish) => {
  x = BigNumber.from(x);
  y = BigNumber.from(y);
  scale = BigNumber.from(scale);
  if (x.eq(0) || y.eq(0)) return BigNumber.from(0);

  return x.mul(y).add(scale.div(2)).div(scale);
};

export class DecimalFormat {
  multiplier: BigNumber;

  constructor(public readonly decimals: number) {
    this.multiplier = BigNumber.from(10).pow(decimals);
  }

  max(other: DecimalFormat) {
    if (other.decimals > this.decimals) return other;

    return this;
  }
}

const _constructorGuard = {};

export class DecimalNumber implements utils.Hexable {
  readonly _value!: BigNumber;
  readonly _format: DecimalFormat;

  readonly _isBigNumber = true; // isBigNumberish(this) === true
  readonly _isDecimalNumber = true;

  constructor(constructorGuard: any, _value: BigNumberish, _format: DecimalFormat) {
    if (constructorGuard !== _constructorGuard)
      throw Error("Cannot use DecimalNumber constructor; use DecimalNumber.from");

    this._format = _format;
    this._value = BigNumber.from(_value);

    Object.freeze(this);
  }

  add(other: DecimalNumber | BigNumberish) {
    if (DecimalNumber.isDecimalNumber(other))
      return new DecimalNumber(
        _constructorGuard,
        this._value.add(other._value),
        this._format.max(other._format)
      );

    return new DecimalNumber(_constructorGuard, this._value.add(other), this._format);
  }

  sub(other: DecimalNumber | BigNumberish) {
    if (DecimalNumber.isDecimalNumber(other))
      return new DecimalNumber(
        _constructorGuard,
        this._value.sub(other._value),
        this._format.max(other._format)
      );

    return new DecimalNumber(_constructorGuard, this._value.sub(other), this._format);
  }

  mul(other: DecimalNumber) {
    return DecimalNumber.from(
      this._value.mul(other._value),
      this._format.decimals + other._format.decimals
    );
  }

  mulUp(other: DecimalNumber) {
    return new DecimalNumber(
      _constructorGuard,
      mulDivUp(
        this._value,
        DecimalNumber.isDecimalNumber(other) ? other._value : other,
        this._format.multiplier
      ),
      this._format
    );
  }

  mulDown(other: DecimalNumber) {
    return new DecimalNumber(
      _constructorGuard,
      this._value
        .mul(DecimalNumber.isDecimalNumber(other) ? other._value : other)
        .div(this._format.multiplier),
      this._format
    );
  }

  div(other: DecimalNumber) {
    return DecimalNumber.from(
      this._value.mul(this._format.multiplier).mul(other._format.multiplier).div(other._value),
      this._format.decimals + other._format.decimals
    );
  }

  divUp(other: DecimalNumber | BigNumberish) {
    return new DecimalNumber(
      _constructorGuard,
      mulDivUp(
        this._value,
        this._format.multiplier,
        DecimalNumber.isDecimalNumber(other) ? other._value : other
      ),
      this._format
    );
  }

  divDown(other: DecimalNumber | BigNumberish) {
    return new DecimalNumber(
      _constructorGuard,
      this._value
        .mul(this._format.multiplier)
        .div(DecimalNumber.isDecimalNumber(other) ? other._value : other),
      this._format
    );
  }

  pow(power: BigNumberish): DecimalNumber {
    power = BigNumber.from(power);
    if (power.eq(0))
      return new DecimalNumber(_constructorGuard, this._format.multiplier, this._format);
    if (power.eq(1)) return this.copy();

    // using this._value.pow would overflow
    return this.mul(this).pow(power.sub(1));
  }

  ceil() {
    if (this._value.mod(this._format.multiplier).isZero())
      return DecimalNumber.from(this._value, this._format.decimals);

    return DecimalNumber.from(
      this._value.div(this._format.multiplier).add(1).mul(this._format.multiplier),
      this._format.decimals
    );
  }

  trunc(decimals?: number) {
    decimals ??= this._format.decimals;

    if (decimals < 0) throw Error(`Invalid decimal count: "${decimals}"`);

    if (decimals >= this._format.decimals)
      return DecimalNumber.from(
        this._value.mul(BigNumber.from(10).pow(decimals - this._format.decimals)),
        decimals
      );

    return DecimalNumber.from(
      this._value.div(BigNumber.from(10).pow(this._format.decimals - decimals)),
      decimals
    );
  }

  round(decimals?: number) {
    decimals ??= this._format.decimals;

    if (decimals < 0) throw Error(`Invalid decimal count: "${decimals}"`);

    if (decimals >= this._format.decimals)
      return DecimalNumber.from(
        this._value.mul(BigNumber.from(10).pow(decimals - this._format.decimals)),
        decimals
      );

    const multiplier = BigNumber.from(10).pow(this._format.decimals - decimals);
    return DecimalNumber.from(this._value.add(multiplier.div(2)).div(multiplier), decimals);
  }

  copy() {
    return new DecimalNumber(_constructorGuard, this._value, this._format);
  }

  isZero() {
    return this._value.isZero();
  }

  isNegative() {
    return this._value.isNegative();
  }

  toFixed(decimals?: number) {
    return this.trunc(decimals).toString();
  }

  toString() {
    return utils.formatUnits(this._value, this._format.decimals);
  }

  toHexString(): string {
    return this._value.toHexString();
  }

  toFloat() {
    return parseFloat(this.toString());
  }

  static from(value: any, decimals?: number) {
    if (value.toString) value = value.toString();

    if (typeof value !== "string" || !value.match(/^-?[0-9.]+$/))
      throw Error(`Invalid decimal value: "${value}"`);

    if (value === ".")
      return new DecimalNumber(_constructorGuard, constants.Zero, new DecimalFormat(decimals ?? 0));

    const negative = value.substring(0, 1) === "-";
    if (negative) {
      value = value.substring(1);
    }

    const comps = value.split(".");
    if (comps.length > 2) throw Error(`Too many decimal points: "${value}"`);

    let fraction = "0";
    if (comps.length > 1) {
      fraction = comps[1];
      decimals = fraction.length;
    }

    if (decimals != null) {
      fraction = fraction.padEnd(decimals, "0");

      if (fraction.length > decimals)
        throw Error(
          `Fractional component exceeds decimals: length received is ${fraction.length}, expected ${decimals}`
        );
    }

    decimals ??= 0;

    let wei = BigNumber.from(10)
      .pow(decimals)
      .mul(comps[0] || constants.Zero)
      .add(fraction);
    if (negative) wei = wei.mul(-1);

    return new DecimalNumber(_constructorGuard, wei, new DecimalFormat(decimals));
  }

  static isDecimalNumber(value: any): value is DecimalNumber {
    return !!(value && value._isDecimalNumber);
  }
}
