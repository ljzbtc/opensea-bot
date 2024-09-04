import { ethers } from "ethers";
import { OpenSeaSDK, Chain } from "opensea-js";
import dotenv from "dotenv";

dotenv.config();

// Load environment variables
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;
const RPC_API_KEY = process.env.RPC_API_KEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const WETH_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const SEA_PORT_1_6="0x0000000000000068F116a894984e2DB1123eB395"

// Check if all environment variables are provided
if (!OPENSEA_API_KEY || !RPC_API_KEY || !PRIVATE_KEY) {
  throw new Error("Please provide all necessary environment variables");
}

// Create provider
const provider = new ethers.JsonRpcProvider(RPC_API_KEY);

// Create wallet
const walletWithProvider = new ethers.Wallet(PRIVATE_KEY, provider);

// Create OpenSeaSDK instance
const openseaSDK = new OpenSeaSDK(walletWithProvider, {
  chain: Chain.Mainnet,
  apiKey: OPENSEA_API_KEY,
});

// Function to convert wei to WETH
function weiToWETH(weiValue) {
  return Number(ethers.formatEther(weiValue));
}

// Function to parse protocol data
function parseProtocolData(protocolData) {
  if (!protocolData || !protocolData.parameters) return null;

  const params = protocolData.parameters;
  const consideration = params.consideration?.[0];
  const offer = params.offer?.[0];

  if (!consideration || !offer) return null;

  const offerAmount = BigInt(offer.startAmount);
  const quantity = BigInt(consideration.startAmount);
  const unitPrice = quantity > 0n ? offerAmount / quantity : 0n;

  return {
    offerer: params.offerer,
    zone: params.zone,
    tokenType: offer.itemType,
    token: offer.token,
    identifierOrCriteria: offer.identifierOrCriteria,
    quantity: Number(quantity),
    totalPrice: weiToWETH(offerAmount),
    unitPrice: weiToWETH(unitPrice),
  };
}

// Function to check if an offer is a pure collection offer
function isPureCollectionOffer(offer) {
  console.log(offer.criteria?.trait);
  return (
    offer.criteria?.trait === null &&
    offer.criteria?.encoded_token_ids === null &&
    offer.protocol_data?.parameters?.offer?.[0]?.identifierOrCriteria === "0"
  );
}

// Analyze the pure collection offers
function analyzePureCollectionOffers(offersData) {
  if (!offersData || !Array.isArray(offersData) || offersData.length === 0) {
    console.log("No valid offers data to analyze.");
    return null;
  }

  let totalWETH = 0;
  let highestUnitPrice = 0;
  let lowestUnitPrice = Infinity;
  const offerDetails = [];

  offersData.forEach((offer) => {
    if (!isPureCollectionOffer(offer)) {
      return; // Skip if not a pure collection offer
    }

    const protocolInfo = parseProtocolData(offer.protocol_data);
    if (!protocolInfo) {
      console.log("Skipping offer with invalid protocol data:", offer);
      return;
    }

    const { unitPrice, quantity, totalPrice } = protocolInfo;
    totalWETH += totalPrice;

    if (unitPrice > highestUnitPrice) highestUnitPrice = unitPrice;
    if (unitPrice < lowestUnitPrice) lowestUnitPrice = unitPrice;

    offerDetails.push({
      unitPrice,
      quantity,
      totalPrice,
      orderHash: offer.order_hash,
      offerer: protocolInfo.offerer,
    });
  });

  if (offerDetails.length === 0) {
    console.log("No valid pure collection offers found.");
    return null;
  }

  // Sort offers by unit price in descending order
  offerDetails.sort((a, b) => b.unitPrice - a.unitPrice);

  const averageUnitPrice =
    offerDetails.reduce((sum, offer) => sum + offer.unitPrice, 0) /
    offerDetails.length;

  return {
    totalOffers: offerDetails.length,
    highestUnitPrice,
    lowestUnitPrice,
    averageUnitPrice,
    totalWETH,
    sortedOffers: offerDetails,
    uniquePrices: new Set(offerDetails.map((offer) => offer.unitPrice)).size,
  };
}

// Main function to fetch and analyze offers
async function main() {
  // try {
    const collectionSlug = "tableland-rigs";
    const offersResponse = await openseaSDK.api.getAllOffers(collectionSlug);

    if (!offersResponse || !offersResponse.offers) {
      throw new Error("Unexpected response format from OpenSea API");
    }

    const analysis = analyzePureCollectionOffers(offersResponse.offers);

    console.log(analysis.highestUnitPrice);
    console.log(analysis.highestUnitPrice * 1e18 + 1000);
    console.log(analysis.sortedOffers[0].offerer);
    console.log(analysis.sortedOffers[0].orderHash);


  //   if (analysis) {
  //     console.log("Pure Collection Offer Analysis:");
  //     console.log(`Total Pure Collection Offers: ${analysis.totalOffers}`);
  //     console.log(
  //       `Highest Unit Price: ${analysis.highestUnitPrice.toFixed(4)} WETH`
  //     );
  //     console.log(
  //       `Lowest Unit Price: ${analysis.lowestUnitPrice.toFixed(4)} WETH`
  //     );
  //     console.log(
  //       `Average Unit Price: ${analysis.averageUnitPrice.toFixed(4)} WETH`
  //     );
  //     console.log(`Total WETH Offered: ${analysis.totalWETH.toFixed(4)} WETH`);
  //     console.log(`Unique Prices: ${analysis.uniquePrices}`);

  //     console.log(
  //       "\nPure Collection Offers Sorted by Unit Price (Descending):"
  //     );
  //     analysis.sortedOffers.forEach((offer, index) => {
  //       console.log(`Offer ${index + 1}:`);
  //       console.log(`  Unit Price: ${offer.unitPrice.toFixed(4)} WETH`);
  //       console.log(`  Quantity: ${offer.quantity}`);
  //       console.log(`  Total Price: ${offer.totalPrice.toFixed(4)} WETH`);
  //       console.log(`  Order Hash: ${offer.orderHash}`);
  //       console.log(`  Offerer: ${offer.offerer || "N/A"}`);
  //       console.log("  -----------------");
  //     });
  //   }
  // } catch (error) {
  //   console.error("An error occurred:", error);
  // }

  const collection = await openseaSDK.api.getCollection("tableland-rigs");

  // console.log(collection); 

  console.log(walletWithProvider.address);


  const makeOffer = await openseaSDK.createCollectionOffer({
    collectionSlug: collection.collection,
    accountAddress: walletWithProvider.address,
    paymentTokenAddress: WETH_ADDRESS,
    amount: 0.04,
    quantity: 1,

  });

  // TODO: cancle offer
  

  // const cancelOffer = await openseaSDK.offchainCancelOrder({
  //   protocolAddress: SEA_PORT_1_6,
  //   orderHash: "0x232a196e57d2709db5469c3a306d72172ac24e867684e70d1e5f62082eccd9d3",
  // });
  console.log(makeOffer);
  // console.log(cancelOffer);
}

// Run the main function
main();
