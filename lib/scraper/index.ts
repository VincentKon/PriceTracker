"use server";

import axios from "axios";
import * as cheerio from "cheerio";
import {
  extractCurrency,
  extractDescription,
  extractFeatures,
  extractPrice,
  normalizeCategory,
  normalizeOriginalPrice,
  normalizeReviewsCount,
  normalizeStars,
} from "../utils";
import { Description } from "@headlessui/react";

export async function scrapeAmazonProduct(url: string) {
  if (!url) return;

  // BrightData proxy configuration
  //   curl -i --proxy brd.superproxy.io:33335 --proxy-user brd-customer-hl_1132cef0-zone-web_unlocker1:yc2dgjav5kci -k "https://geo.brdtest.com/welcome.txt?product=unlocker&method=native"
  const username = String(process.env.BRIGHT_DATA_USERNAME);
  const password = String(process.env.BRIGHT_DATA_PASSWORD);
  const port = 33335;
  const session_id = (1000000 * Math.random()) | 0;

  const options = {
    auth: {
      username: `${username}-session-${session_id}`,
      password,
    },
    host: "brd.superproxy.io",
    port,
    rejectUnauthorized: false,
  };

  try {
    // Fetch the product page
    const response = await axios.get(url, options);
    const $ = cheerio.load(response.data);

    // Extract the product title
    const title = $("#productTitle").text().trim();
    const reviewsCount = normalizeReviewsCount(
      $("#acrCustomerReviewText").text().trim()
    );
    const stars = normalizeStars($("#acrPopover").text().trim());
    const category = normalizeCategory(
      $("#wayfinding-breadcrumbs_feature_div").text().trim()
    );
    const description = extractFeatures($);

    const currentPrice = extractPrice(
      $(".priceToPay span.a-price-whole"),
      $(".a.size.base.a-color-price"),
      $(".a-button-selected .a-color-base")
    );

    // NEED IMPROVEMENTS, THERE IS NO ID THAT TARGETS THE ORIGINAL PRICE SO THE ALT APPROACH IS TO RUN THIS IF THERE IS A DISCOUNT RATE
    const originalPrice = extractPrice(
      $("#priceblock_ourprice"),
      $(".a-price.a-text-price span.a-offscreen"),
      $("#listPrice"),
      $("#priceblock_dealprice"),
      $(".a-size-base.a-color-price")
    );
    // const originalPrice = normalizeOriginalPrice(
    //   $("#corePrice_feature_div").text().trim()
    // );

    const outOfStock =
      $("#availability span").text().trim().toLowerCase() ===
      "currently unavailable";

    const images =
      $("#imgBlkFront").attr("data-a-dynamic-image") ||
      $("#landingImage").attr("data-a-dynamic-image") ||
      "{}";

    const imageUrls = Object.keys(JSON.parse(images));

    const currency = extractCurrency($(".a-price-symbol"));
    const discountRate = $(".savingsPercentage").text().replace(/[-%]/g, "");

    // const description = extractDescription($);

    // console.log({ stars, category, description, reviewsCount, originalPrice });
    // Construct data object with scraped information
    const data = {
      url,
      currency: currency,
      image: imageUrls[0],
      title,
      currentPrice: Number(currentPrice) || Number(originalPrice),
      originalPrice: Number(originalPrice) || Number(currentPrice),
      priceHistory: [],
      discountRate: Number(discountRate),
      category,
      reviewsCount,
      stars,
      isOutOfStock: outOfStock,
      description: description.join("\n"),
      lowestPrice: Number(currentPrice) || Number(originalPrice),
      highestPrice: Number(originalPrice) || Number(currentPrice),
      averagePrice: Number(currentPrice) || Number(originalPrice),
    };

    return data;
  } catch (error: any) {
    console.log(error);
  }
}
