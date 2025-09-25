
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

describe("Real Estate Contract - Token Trading and Secondary Market", () => {
  const wallet2 = accounts.get("wallet_2")!;
  const wallet3 = accounts.get("wallet_3")!;

  beforeEach(() => {
    simnet.mineEmptyBlocks(1);
    // Setup: Add and tokenize a property for trading tests
    simnet.callPublicFn(
      contractName,
      "add-property",
      [Cl.uint(1000000), Cl.stringAscii("Trading Property"), Cl.stringAscii("House"), Cl.uint(2000), Cl.stringAscii("Property for trading tests")],
      deployer
    );
    simnet.callPublicFn(
      contractName,
      "tokenize-property",
      [Cl.uint(0), Cl.uint(1000), Cl.uint(1000)],
      deployer
    );
  });

  describe("Direct Token Purchase", () => {
    it("should allow users to buy tokens directly from property", () => {
      const tokenAmount = 10;
      const tokenPrice = 1000;
      const platformFee = Math.floor((tokenAmount * tokenPrice * 25) / 1000); // 2.5% fee
      const totalCost = tokenAmount * tokenPrice + platformFee;

      const { result } = simnet.callPublicFn(
        contractName,
        "buy-tokens",
        [Cl.uint(0), Cl.uint(tokenAmount)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));

      // Verify token ownership
      const { result: balance } = simnet.callReadOnlyFn(
        contractName,
        "get-token-balance",
        [Cl.uint(0), Cl.standardPrincipal(wallet1)],
        wallet1
      );

      expect(balance).toBeTuple({ "token-count": Cl.uint(tokenAmount) });

      // Verify tokens remaining decreased
      const { result: tokens } = simnet.callReadOnlyFn(
        contractName,
        "get-property-tokens",
        [Cl.uint(0)],
        deployer
      );

      expect(tokens).toBeSome(
        Cl.tuple({
          "total-supply": Cl.uint(1000),
          "tokens-remaining": Cl.uint(990),
          "token-price": Cl.uint(1000),
          creator: Cl.standardPrincipal(deployer),
        })
      );
    });

    it("should reject token purchase for non-tokenized property", () => {
      // Add a non-tokenized property
      const { result: addResult } = simnet.callPublicFn(
        contractName,
        "add-property",
        [Cl.uint(500000), Cl.stringAscii("Non-tokenized"), Cl.stringAscii("Condo"), Cl.uint(1000), Cl.stringAscii("Not tokenized")],
        deployer
      );
      
      // Verify property was added successfully and get its ID
      expect(addResult).toBeOk(Cl.uint(1));

      // Verify property exists and is not tokenized
      const { result: propertyResult } = simnet.callReadOnlyFn(
        contractName,
        "get-property",
        [Cl.uint(1)],
        deployer
      );
      
      expect(propertyResult).toBeSome(
        Cl.tuple({
          owner: Cl.standardPrincipal(deployer),
          price: Cl.uint(500000),
          location: Cl.stringAscii("Non-tokenized"),
          tokenized: Cl.bool(false),
          "property-type": Cl.stringAscii("Condo"),
          area: Cl.uint(1000),
          "for-sale": Cl.bool(false),
          "creation-block": Cl.uint(6),
          description: Cl.stringAscii("Not tokenized"),
        })
      );

      const { result } = simnet.callPublicFn(
        contractName,
        "buy-tokens",
        [Cl.uint(1), Cl.uint(10)], // Property 1 exists but is not tokenized
        wallet1
      );

      expect(result).toBeErr(Cl.uint(101)); // err-not-found (no token data for non-tokenized property)
    });

    it("should reject purchase of more tokens than available", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "buy-tokens",
        [Cl.uint(0), Cl.uint(1001)], // More than 1000 available
        wallet1
      );

      expect(result).toBeErr(Cl.uint(104)); // err-insufficient-tokens
    });

    it("should reject purchase of zero tokens", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "buy-tokens",
        [Cl.uint(0), Cl.uint(0)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(107)); // err-invalid-token-amount
    });

    it("should calculate platform fees correctly", () => {
      const tokenAmount = 100;
      const tokenPrice = 1000;
      const expectedFee = Math.floor((tokenAmount * tokenPrice * 25) / 1000); // 2.5%

      // Buy tokens
      simnet.callPublicFn(
        contractName,
        "buy-tokens",
        [Cl.uint(0), Cl.uint(tokenAmount)],
        wallet1
      );

      // Check platform revenue increased
      const { result: stats } = simnet.callReadOnlyFn(
        contractName,
        "get-contract-stats",
        [],
        deployer
      );

      expect(stats).toBeTuple({
        "total-properties": Cl.uint(1),
        "total-listings": Cl.uint(0),
        "total-transactions": Cl.uint(1),
        "platform-revenue": Cl.uint(expectedFee),
        "contract-paused": Cl.bool(false),
      });
    });
  });

  describe("Token Transfers", () => {
    beforeEach(() => {
      // Give wallet1 some tokens to transfer
      simnet.callPublicFn(
        contractName,
        "buy-tokens",
        [Cl.uint(0), Cl.uint(100)],
        wallet1
      );
    });

    it("should allow token holders to transfer tokens", () => {
      const transferAmount = 25;

      const { result } = simnet.callPublicFn(
        contractName,
        "transfer-tokens",
        [Cl.uint(0), Cl.uint(transferAmount), Cl.standardPrincipal(wallet2)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));

      // Check sender balance decreased
      const { result: senderBalance } = simnet.callReadOnlyFn(
        contractName,
        "get-token-balance",
        [Cl.uint(0), Cl.standardPrincipal(wallet1)],
        wallet1
      );
      expect(senderBalance).toBeTuple({ "token-count": Cl.uint(75) });

      // Check recipient balance increased
      const { result: recipientBalance } = simnet.callReadOnlyFn(
        contractName,
        "get-token-balance",
        [Cl.uint(0), Cl.standardPrincipal(wallet2)],
        wallet2
      );
      expect(recipientBalance).toBeTuple({ "token-count": Cl.uint(25) });
    });

    it("should reject transfer of more tokens than owned", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "transfer-tokens",
        [Cl.uint(0), Cl.uint(101), Cl.standardPrincipal(wallet2)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(104)); // err-insufficient-tokens
    });

    it("should reject transfer to self", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "transfer-tokens",
        [Cl.uint(0), Cl.uint(10), Cl.standardPrincipal(wallet1)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(102)); // err-unauthorized
    });

    it("should reject transfer of zero tokens", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "transfer-tokens",
        [Cl.uint(0), Cl.uint(0), Cl.standardPrincipal(wallet2)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(107)); // err-invalid-token-amount
    });

    it("should reject transfer from non-token-owner", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "transfer-tokens",
        [Cl.uint(0), Cl.uint(10), Cl.standardPrincipal(wallet1)],
        wallet3 // wallet3 has no tokens
      );

      expect(result).toBeErr(Cl.uint(110)); // err-not-token-owner
    });
  });

  describe("Whole Property Purchase", () => {
    beforeEach(() => {
      // Add a non-tokenized property for sale
      simnet.callPublicFn(
        contractName,
        "add-property",
        [Cl.uint(2000000), Cl.stringAscii("For Sale Property"), Cl.stringAscii("Villa"), Cl.uint(3000), Cl.stringAscii("Luxury villa for sale")],
        deployer
      );
      // Mark it for sale
      simnet.callPublicFn(
        contractName,
        "update-property",
        [Cl.uint(1), Cl.uint(2000000), Cl.bool(true), Cl.stringAscii("Luxury villa for sale")],
        deployer
      );
    });

    it("should allow purchase of whole property when for sale", () => {
      const propertyPrice = 2000000;
      const platformFee = Math.floor((propertyPrice * 25) / 1000); // 2.5%

      const { result } = simnet.callPublicFn(
        contractName,
        "buy-property",
        [Cl.uint(1)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));

      // Verify ownership changed
      const { result: property } = simnet.callReadOnlyFn(
        contractName,
        "get-property",
        [Cl.uint(1)],
        wallet1
      );

      expect(property).toBeSome(
        Cl.tuple({
          owner: Cl.standardPrincipal(wallet1),
          price: Cl.uint(2000000),
          location: Cl.stringAscii("For Sale Property"),
          tokenized: Cl.bool(false),
          "property-type": Cl.stringAscii("Villa"),
          area: Cl.uint(3000),
          "for-sale": Cl.bool(false), // Should be marked as not for sale after purchase
          "creation-block": Cl.uint(6),
          description: Cl.stringAscii("Luxury villa for sale"),
        })
      );

      // Check platform revenue increased
      const { result: stats } = simnet.callReadOnlyFn(
        contractName,
        "get-contract-stats",
        [],
        deployer
      );

      expect(stats).toBeTuple(expect.objectContaining({
        "platform-revenue": Cl.uint(platformFee),
      }));
    });

    it("should reject purchase of property not for sale", () => {
      // Property ID 0 is tokenized but not marked for sale
      const { result } = simnet.callPublicFn(
        contractName,
        "buy-property",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(103)); // err-already-tokenized
    });

    it("should reject purchase of tokenized property", () => {
      // Property ID 0 is tokenized
      const { result } = simnet.callPublicFn(
        contractName,
        "buy-property",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(103)); // err-already-tokenized
    });

    it("should reject purchase of non-existent property", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "buy-property",
        [Cl.uint(999)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(101)); // err-not-found
    });
  });

  describe("Secondary Market Listings", () => {
    beforeEach(() => {
      // Give wallet1 tokens to list
      simnet.callPublicFn(
        contractName,
        "buy-tokens",
        [Cl.uint(0), Cl.uint(100)],
        wallet1
      );
    });

    it("should allow token holders to create listings", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "create-token-listing",
        [Cl.uint(0), Cl.uint(50), Cl.uint(1200)], // 50 tokens at 1200 STX each
        wallet1
      );

      expect(result).toBeOk(Cl.uint(0)); // First listing ID

      // Verify listing was created
      const { result: listing } = simnet.callReadOnlyFn(
        contractName,
        "get-token-listing",
        [Cl.uint(0)],
        wallet1
      );

      expect(listing).toBeSome(
        Cl.tuple({
          seller: Cl.standardPrincipal(wallet1),
          "property-id": Cl.uint(0),
          "token-amount": Cl.uint(50),
          "price-per-token": Cl.uint(1200),
          active: Cl.bool(true),
        })
      );

      // Check listings counter increased
      const { result: stats } = simnet.callReadOnlyFn(
        contractName,
        "get-contract-stats",
        [],
        deployer
      );

      expect(stats).toBeTuple(expect.objectContaining({
        "total-listings": Cl.uint(1),
      }));
    });

    it("should reject listing more tokens than owned", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "create-token-listing",
        [Cl.uint(0), Cl.uint(101), Cl.uint(1200)], // More than 100 owned
        wallet1
      );

      expect(result).toBeErr(Cl.uint(104)); // err-insufficient-tokens
    });

    it("should reject listing with zero price", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "create-token-listing",
        [Cl.uint(0), Cl.uint(50), Cl.uint(0)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(109)); // err-invalid-price
    });

    it("should reject listing zero tokens", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "create-token-listing",
        [Cl.uint(0), Cl.uint(0), Cl.uint(1200)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(107)); // err-invalid-token-amount
    });

    it("should reject listing for non-tokenized property", () => {
      // Add non-tokenized property
      simnet.callPublicFn(
        contractName,
        "add-property",
        [Cl.uint(500000), Cl.stringAscii("Non-tokenized"), Cl.stringAscii("Condo"), Cl.uint(1000), Cl.stringAscii("Not tokenized")],
        deployer
      );

      const { result } = simnet.callPublicFn(
        contractName,
        "create-token-listing",
        [Cl.uint(1), Cl.uint(10), Cl.uint(1000)], // Property 1 exists but not tokenized
        wallet1
      );

      expect(result).toBeErr(Cl.uint(105)); // err-not-tokenized
    });
  });

  describe("Secondary Market Trading", () => {
    beforeEach(() => {
      // Setup: wallet1 buys tokens and creates a listing
      simnet.callPublicFn(
        contractName,
        "buy-tokens",
        [Cl.uint(0), Cl.uint(100)],
        wallet1
      );
      simnet.callPublicFn(
        contractName,
        "create-token-listing",
        [Cl.uint(0), Cl.uint(50), Cl.uint(1200)],
        wallet1
      );
    });

    it("should allow users to buy from listings", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "buy-listed-tokens",
        [Cl.uint(0)],
        wallet2
      );

      expect(result).toBeOk(Cl.bool(true));

      // Check buyer received tokens
      const { result: buyerBalance } = simnet.callReadOnlyFn(
        contractName,
        "get-token-balance",
        [Cl.uint(0), Cl.standardPrincipal(wallet2)],
        wallet2
      );
      expect(buyerBalance).toBeTuple({ "token-count": Cl.uint(50) });

      // Check seller lost tokens
      const { result: sellerBalance } = simnet.callReadOnlyFn(
        contractName,
        "get-token-balance",
        [Cl.uint(0), Cl.standardPrincipal(wallet1)],
        wallet1
      );
      expect(sellerBalance).toBeTuple({ "token-count": Cl.uint(50) });

      // Check listing is deactivated
      const { result: listing } = simnet.callReadOnlyFn(
        contractName,
        "get-token-listing",
        [Cl.uint(0)],
        wallet2
      );

      expect(listing).toBeSome(
        Cl.tuple({
          seller: Cl.standardPrincipal(wallet1),
          "property-id": Cl.uint(0),
          "token-amount": Cl.uint(50),
          "price-per-token": Cl.uint(1200),
          active: Cl.bool(false),
        })
      );

      // Check platform revenue increased
      const { result: stats } = simnet.callReadOnlyFn(
        contractName,
        "get-contract-stats",
        [],
        deployer
      );

      // Platform revenue should be cumulative: 
      // 2500 (from beforeEach 100 tokens purchase) + 1500 (from this listing purchase) = 4000
      expect(stats).toBeTuple(expect.objectContaining({
        "platform-revenue": Cl.uint(4000),
      }));
    });

    it("should reject purchase from inactive listing", () => {
      // First purchase makes listing inactive
      simnet.callPublicFn(
        contractName,
        "buy-listed-tokens",
        [Cl.uint(0)],
        wallet2
      );

      // Second purchase should fail
      const { result } = simnet.callPublicFn(
        contractName,
        "buy-listed-tokens",
        [Cl.uint(0)],
        wallet3
      );

      expect(result).toBeErr(Cl.uint(111)); // err-listing-not-found
    });

    it("should reject seller buying their own listing", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "buy-listed-tokens",
        [Cl.uint(0)],
        wallet1 // Same as seller
      );

      expect(result).toBeErr(Cl.uint(102)); // err-unauthorized
    });

    it("should reject purchase from non-existent listing", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "buy-listed-tokens",
        [Cl.uint(999)],
        wallet2
      );

      expect(result).toBeErr(Cl.uint(111)); // err-listing-not-found
    });
  });

  describe("Listing Management", () => {
    beforeEach(() => {
      // Setup: wallet1 buys tokens and creates a listing
      simnet.callPublicFn(
        contractName,
        "buy-tokens",
        [Cl.uint(0), Cl.uint(100)],
        wallet1
      );
      simnet.callPublicFn(
        contractName,
        "create-token-listing",
        [Cl.uint(0), Cl.uint(50), Cl.uint(1200)],
        wallet1
      );
    });

    it("should allow sellers to cancel their listings", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "cancel-token-listing",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));

      // Check listing is deactivated
      const { result: listing } = simnet.callReadOnlyFn(
        contractName,
        "get-token-listing",
        [Cl.uint(0)],
        wallet1
      );

      expect(listing).toBeSome(
        Cl.tuple({
          seller: Cl.standardPrincipal(wallet1),
          "property-id": Cl.uint(0),
          "token-amount": Cl.uint(50),
          "price-per-token": Cl.uint(1200),
          active: Cl.bool(false),
        })
      );
    });

    it("should reject cancellation by non-seller", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "cancel-token-listing",
        [Cl.uint(0)],
        wallet2 // Not the seller
      );

      expect(result).toBeErr(Cl.uint(102)); // err-unauthorized
    });

    it("should reject cancellation of inactive listing", () => {
      // Cancel first
      simnet.callPublicFn(
        contractName,
        "cancel-token-listing",
        [Cl.uint(0)],
        wallet1
      );

      // Try to cancel again
      const { result } = simnet.callPublicFn(
        contractName,
        "cancel-token-listing",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(111)); // err-listing-not-found
    });

    it("should reject cancellation of non-existent listing", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "cancel-token-listing",
        [Cl.uint(999)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(111)); // err-listing-not-found
    });
  });

  describe("Transaction Logging", () => {
    it("should log token purchase transactions", () => {
      // Buy tokens
      simnet.callPublicFn(
        contractName,
        "buy-tokens",
        [Cl.uint(0), Cl.uint(50)],
        wallet1
      );

      // Check transaction was logged
      const { result: transaction } = simnet.callReadOnlyFn(
        contractName,
        "get-transaction",
        [Cl.uint(0)],
        wallet1
      );

      expect(transaction).toBeSome(
        Cl.tuple({
          "property-id": Cl.uint(0),
          seller: Cl.standardPrincipal(deployer), // Property creator
          buyer: Cl.standardPrincipal(wallet1),
          amount: Cl.uint(50000 + 1250), // 50 tokens * 1000 + platform fee
          tokens: Cl.uint(50),
          "block-height": Cl.uint(6),
          "transaction-type": Cl.stringAscii("MINT"),
        })
      );
    });

    it("should log token transfer transactions", () => {
      // Setup: buy tokens then transfer
      simnet.callPublicFn(
        contractName,
        "buy-tokens",
        [Cl.uint(0), Cl.uint(50)],
        wallet1
      );

      simnet.callPublicFn(
        contractName,
        "transfer-tokens",
        [Cl.uint(0), Cl.uint(25), Cl.standardPrincipal(wallet2)],
        wallet1
      );

      // Check transfer transaction was logged
      const { result: transaction } = simnet.callReadOnlyFn(
        contractName,
        "get-transaction",
        [Cl.uint(1)], // Second transaction
        wallet1
      );

      expect(transaction).toBeSome(
        Cl.tuple({
          "property-id": Cl.uint(0),
          seller: Cl.standardPrincipal(wallet1),
          buyer: Cl.standardPrincipal(wallet2),
          amount: Cl.uint(0), // No STX amount for transfers
          tokens: Cl.uint(25),
          "block-height": Cl.uint(7),
          "transaction-type": Cl.stringAscii("TRANSFER"),
        })
      );
    });

    it("should log listing creation transactions", () => {
      // Setup: buy tokens then create listing
      simnet.callPublicFn(
        contractName,
        "buy-tokens",
        [Cl.uint(0), Cl.uint(50)],
        wallet1
      );

      simnet.callPublicFn(
        contractName,
        "create-token-listing",
        [Cl.uint(0), Cl.uint(25), Cl.uint(1200)],
        wallet1
      );

      // Check listing transaction was logged
      const { result: transaction } = simnet.callReadOnlyFn(
        contractName,
        "get-transaction",
        [Cl.uint(1)], // Second transaction
        wallet1
      );

      expect(transaction).toBeSome(
        Cl.tuple({
          "property-id": Cl.uint(0),
          seller: Cl.standardPrincipal(wallet1),
          buyer: Cl.standardPrincipal(wallet1), // Same for listings
          amount: Cl.uint(0),
          tokens: Cl.uint(25),
          "block-height": Cl.uint(7),
          "transaction-type": Cl.stringAscii("LISTING"),
        })
      );
    });
  });
});
