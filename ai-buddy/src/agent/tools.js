const { tool } = require("@langchain/core/tools");
const { default: axios } = require("axios");
const { z } = require("zod");

const searchProduct = tool(async ({ query, token }) => {
    const response = await axios.get(`http://localhost:3001/api/products?skip=0&limit=5&q=${query}`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    return JSON.stringify(response.data);
}, {
  name: "searchProduct",
  description: "Search for a product by query",
  schema: z.object({
    query: z.string().describe("The search query for the product"),
  }),
});

const addProductToCart = tool(async ({ productId, quantity = 1, token }) => {
  // Defensive input normalization
  let pid = productId;
  if (pid && typeof pid === 'object') {
    // If an object was passed (for example a document), try common id fields
    pid = pid._id ?? pid.id ?? JSON.stringify(pid);
  }
  pid = pid != null ? String(pid) : '';

  let qty = Number(quantity ?? 1);
  if (!Number.isFinite(qty) || isNaN(qty)) qty = 1;
  qty = Math.max(1, Math.floor(qty));

  if (!pid) {
    throw new Error('addProductToCart: productId is required');
  }

  await axios.post(
    `http://localhost:3002/api/cart/items`,
    { productId: pid, qty },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return `Product with ID ${pid} added to cart with quantity ${qty}.`;
}, {
  name: "addProductToCart",
  description: "Add a product to the shopping cart",
  schema: z.object({
    productId: z.string().describe("The ID of the product to add"),
    quantity: z.number().default(1).describe("The quantity of the product to add"),
  }),
});

module.exports = {
    searchProduct,
    addProductToCart
};
