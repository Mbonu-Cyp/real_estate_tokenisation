
import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;

const contractName = "real_estate";

describe("Real Estate Contract - Property Management", () => {
  beforeEach(() => {
    simnet.mineEmptyBlocks(1);
  });

  describe("Property Addition", () => {
    it("should allow contract owner to add a property", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "add-property",
        [
          Cl.uint(1000000), // price: 1,000,000 STX
          Cl.stringAscii("New York"), // location
          Cl.stringAscii("Apartment"), // property-type
          Cl.uint(1500), // area: 1500 sq ft
          Cl.stringAscii("Beautiful apartment in Manhattan"), // description
        ],
        deployer
      );
      
      expect(result).toBeOk(Cl.uint(0));
      
      // Verify property was added correctly
      const { result: property } = simnet.callReadOnlyFn(
        contractName,
        "get-property",
        [Cl.uint(0)],
        deployer
      );
      
      expect(property).toBeSome(Cl.tuple({
        owner: Cl.standardPrincipal(deployer),
        price: Cl.uint(1000000),
        location: Cl.stringAscii("New York"),
        tokenized: Cl.bool(false),
        "property-type": Cl.stringAscii("Apartment"),
        area: Cl.uint(1500),
        "for-sale": Cl.bool(false),
        "creation-block": Cl.uint(4),
        description: Cl.stringAscii("Beautiful apartment in Manhattan"),
      }));
    });

    it("should reject property addition with zero price", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "add-property",
        [
          Cl.uint(0), // invalid price
          Cl.stringAscii("New York"),
          Cl.stringAscii("Apartment"),
          Cl.uint(1500),
          Cl.stringAscii("Test property"),
        ],
        deployer
      );
      
      expect(result).toBeErr(Cl.uint(109)); // err-invalid-price
    });

    it("should reject property addition from non-owner", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "add-property",
        [
          Cl.uint(1000000),
          Cl.stringAscii("New York"),
          Cl.stringAscii("Apartment"),
          Cl.uint(1500),
          Cl.stringAscii("Test property"),
        ],
        wallet1
      );
      
      expect(result).toBeErr(Cl.uint(100)); // err-owner-only
    });

    it("should increment property counter correctly", () => {
      // Add first property
      simnet.callPublicFn(
        contractName,
        "add-property",
        [Cl.uint(1000000), Cl.stringAscii("NY"), Cl.stringAscii("Apt"), Cl.uint(1500), Cl.stringAscii("Test1")],
        deployer
      );
      
      // Add second property
      const { result } = simnet.callPublicFn(
        contractName,
        "add-property",
        [Cl.uint(2000000), Cl.stringAscii("LA"), Cl.stringAscii("House"), Cl.uint(2500), Cl.stringAscii("Test2")],
        deployer
      );
      
      expect(result).toBeOk(Cl.uint(1));
      
      // Check total properties
      const { result: stats } = simnet.callReadOnlyFn(
        contractName,
        "get-contract-stats",
        [],
        deployer
      );
      
      expect(stats).toBeTuple({
        "total-properties": Cl.uint(2),
        "total-listings": Cl.uint(0),
        "total-transactions": Cl.uint(0),
        "platform-revenue": Cl.uint(0),
        "contract-paused": Cl.bool(false),
      });
    });
  });

  describe("Property Updates", () => {
    beforeEach(() => {
      // Add a property for testing updates
      simnet.callPublicFn(
        contractName,
        "add-property",
        [Cl.uint(1000000), Cl.stringAscii("NY"), Cl.stringAscii("Apt"), Cl.uint(1500), Cl.stringAscii("Original desc")],
        deployer
      );
    });

    it("should allow property owner to update property details", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "update-property",
        [
          Cl.uint(0), // property-id
          Cl.uint(1500000), // new price
          Cl.bool(true), // for-sale
          Cl.stringAscii("Updated description"), // new description
        ],
        deployer
      );
      
      expect(result).toBeOk(Cl.bool(true));
      
      // Verify updates
      const { result: property } = simnet.callReadOnlyFn(
        contractName,
        "get-property",
        [Cl.uint(0)],
        deployer
      );
      
      expect(property).toBeSome(Cl.tuple({
        owner: Cl.standardPrincipal(deployer),
        price: Cl.uint(1500000),
        location: Cl.stringAscii("NY"),
        tokenized: Cl.bool(false),
        "property-type": Cl.stringAscii("Apt"),
        area: Cl.uint(1500),
        "for-sale": Cl.bool(true),
        "creation-block": Cl.uint(4),
        description: Cl.stringAscii("Updated description"),
      }));
    });

    it("should reject update from non-owner", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "update-property",
        [Cl.uint(0), Cl.uint(1500000), Cl.bool(true), Cl.stringAscii("Updated")],
        wallet1
      );
      
      expect(result).toBeErr(Cl.uint(102)); // err-unauthorized
    });

    it("should reject update with zero price", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "update-property",
        [Cl.uint(0), Cl.uint(0), Cl.bool(true), Cl.stringAscii("Updated")],
        deployer
      );
      
      expect(result).toBeErr(Cl.uint(109)); // err-invalid-price
    });

    it("should reject update for non-existent property", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "update-property",
        [Cl.uint(999), Cl.uint(1500000), Cl.bool(true), Cl.stringAscii("Updated")],
        deployer
      );
      
      expect(result).toBeErr(Cl.uint(101)); // err-not-found
    });
  });

  describe("Property Tokenization", () => {
    beforeEach(() => {
      // Add a property for tokenization
      simnet.callPublicFn(
        contractName,
        "add-property",
        [Cl.uint(1000000), Cl.stringAscii("NY"), Cl.stringAscii("Apt"), Cl.uint(1500), Cl.stringAscii("For tokenization")],
        deployer
      );
    });

    it("should allow property owner to tokenize property", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "tokenize-property",
        [
          Cl.uint(0), // property-id
          Cl.uint(1000), // total-tokens
          Cl.uint(1000), // token-price (1000 STX per token)
        ],
        deployer
      );
      
      expect(result).toBeOk(Cl.bool(true));
      
      // Verify property is marked as tokenized
      const { result: property } = simnet.callReadOnlyFn(
        contractName,
        "get-property",
        [Cl.uint(0)],
        deployer
      );
      
      expect(property).toBeSome(
        Cl.tuple({
          owner: Cl.standardPrincipal(deployer),
          price: Cl.uint(1000000),
          location: Cl.stringAscii("NY"),
          tokenized: Cl.bool(true),
          "property-type": Cl.stringAscii("Apt"),
          area: Cl.uint(1500),
          "for-sale": Cl.bool(false),
          "creation-block": Cl.uint(4),
          description: Cl.stringAscii("For tokenization"),
        })
      );
      
      // Verify token details
      const { result: tokens } = simnet.callReadOnlyFn(
        contractName,
        "get-property-tokens",
        [Cl.uint(0)],
        deployer
      );
      
      expect(tokens).toBeSome(Cl.tuple({
        "total-supply": Cl.uint(1000),
        "tokens-remaining": Cl.uint(1000),
        "token-price": Cl.uint(1000),
        creator: Cl.standardPrincipal(deployer),
      }));
    });

    it("should reject tokenization from non-owner", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "tokenize-property",
        [Cl.uint(0), Cl.uint(1000), Cl.uint(1000)],
        wallet1
      );
      
      expect(result).toBeErr(Cl.uint(102)); // err-unauthorized
    });

    it("should reject tokenization with zero tokens", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "tokenize-property",
        [Cl.uint(0), Cl.uint(0), Cl.uint(1000)],
        deployer
      );
      
      expect(result).toBeErr(Cl.uint(107)); // err-invalid-token-amount
    });

    it("should reject tokenization with zero token price", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "tokenize-property",
        [Cl.uint(0), Cl.uint(1000), Cl.uint(0)],
        deployer
      );
      
      expect(result).toBeErr(Cl.uint(109)); // err-invalid-price
    });

    it("should reject double tokenization", () => {
      // First tokenization
      simnet.callPublicFn(
        contractName,
        "tokenize-property",
        [Cl.uint(0), Cl.uint(1000), Cl.uint(1000)],
        deployer
      );
      
      // Second tokenization should fail
      const { result } = simnet.callPublicFn(
        contractName,
        "tokenize-property",
        [Cl.uint(0), Cl.uint(500), Cl.uint(2000)],
        deployer
      );
      
      expect(result).toBeErr(Cl.uint(103)); // err-already-tokenized
    });

    it("should reject tokenization for non-existent property", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "tokenize-property",
        [Cl.uint(999), Cl.uint(1000), Cl.uint(1000)],
        deployer
      );
      
      expect(result).toBeErr(Cl.uint(101)); // err-not-found
    });

    it("should initialize token ownership correctly", () => {
      simnet.callPublicFn(
        contractName,
        "tokenize-property",
        [Cl.uint(0), Cl.uint(1000), Cl.uint(1000)],
        deployer
      );
      
      // Check initial token balance (should be 0 for creator)
      const { result: balance } = simnet.callReadOnlyFn(
        contractName,
        "get-token-balance",
        [Cl.uint(0), Cl.standardPrincipal(deployer)],
        deployer
      );
      
      expect(balance).toBeTuple({ "token-count": Cl.uint(0) });
    });
  });

  describe("Contract State Management", () => {
    it("should track contract statistics correctly", () => {
      // Initial state
      const { result: initialStats } = simnet.callReadOnlyFn(
        contractName,
        "get-contract-stats",
        [],
        deployer
      );
      
      expect(initialStats).toBeTuple({
        "total-properties": Cl.uint(0),
        "total-listings": Cl.uint(0),
        "total-transactions": Cl.uint(0),
        "platform-revenue": Cl.uint(0),
        "contract-paused": Cl.bool(false),
      });
      
      // Add properties and check stats
      simnet.callPublicFn(
        contractName,
        "add-property",
        [Cl.uint(1000000), Cl.stringAscii("NY"), Cl.stringAscii("Apt"), Cl.uint(1500), Cl.stringAscii("Test1")],
        deployer
      );
      
      simnet.callPublicFn(
        contractName,
        "add-property",
        [Cl.uint(2000000), Cl.stringAscii("LA"), Cl.stringAscii("House"), Cl.uint(2500), Cl.stringAscii("Test2")],
        deployer
      );
      
      const { result: updatedStats } = simnet.callReadOnlyFn(
        contractName,
        "get-contract-stats",
        [],
        deployer
      );
      
      expect(updatedStats).toBeTuple({
        "total-properties": Cl.uint(2),
        "total-listings": Cl.uint(0),
        "total-transactions": Cl.uint(0),
        "platform-revenue": Cl.uint(0),
        "contract-paused": Cl.bool(false),
      });
    });

    it("should track user properties correctly", () => {
      // Initially no properties
      const { result: initialProps } = simnet.callReadOnlyFn(
        contractName,
        "get-user-properties",
        [Cl.standardPrincipal(deployer)],
        deployer
      );
      
      expect(initialProps).toBeTuple({ "owned-properties": Cl.list([]) });
      
      // Add properties
      simnet.callPublicFn(
        contractName,
        "add-property",
        [Cl.uint(1000000), Cl.stringAscii("NY"), Cl.stringAscii("Apt"), Cl.uint(1500), Cl.stringAscii("Test1")],
        deployer
      );
      
      simnet.callPublicFn(
        contractName,
        "add-property",
        [Cl.uint(2000000), Cl.stringAscii("LA"), Cl.stringAscii("House"), Cl.uint(2500), Cl.stringAscii("Test2")],
        deployer
      );
      
      const { result: updatedProps } = simnet.callReadOnlyFn(
        contractName,
        "get-user-properties",
        [Cl.standardPrincipal(deployer)],
        deployer
      );
      
      expect(updatedProps).toBeTuple({ "owned-properties": Cl.list([Cl.uint(0), Cl.uint(1)]) });
    });
  });
});
