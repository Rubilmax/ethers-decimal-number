import { ethers, BigNumber } from "ethers";

import { FixedNumber } from "../src";

describe("ethers-multicall", () => {
  describe("Providers integration", () => {
    it("should work given a JsonRpcProvider", async () => {
      const multicall = new EthersMulticall(rpcProvider);

      expect(multicall.contract.provider).toBe(rpcProvider);
      expect(multicall.contract.address).toBe(MULTICALL_ADDRESSES[1]);

      const wrappedMorpho = multicall.wrap(_morpho);

      expect(wrappedMorpho.address).toBe(_morpho.address);
      expect(await wrappedMorpho.cEth()).toBe("0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5");
    });
  });
});
