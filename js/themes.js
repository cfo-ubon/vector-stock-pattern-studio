const THEME_LIBRARY = {
  "Botanical": ["Scandinavian Botanical","Minimal Eucalyptus","Wildflower Meadow","Tropical Leaves","Vintage Garden","Herb Collection","Olive Branch","Cottage Floral","Autumn Foliage","Evergreen Forest","Ditsy Floral","Pressed Flowers","Sage Botanical","Laurel Minimal","Fern Study","Botanical Line Art","Neutral Foliage","Garden Herbs","Meadow Sprigs","Soft Leaf Repeat"],
  "Geometric": ["Mid Century Modern","Bauhaus Geometry","Scandinavian Geometry","Memphis Soft","Organic Shapes","Abstract Lines","Minimal Grid","Retro Geometry","Art Deco","Seamless Tile","Terrazzo Minimal","Rounded Arch","Checker Geometry","Geo Floral","Soft Diamond","Wavy Grid","Modern Mosaic","Circle Dot","Block Print Geo","Minimal Stripe"],
  "Textile": ["Boho Textile","Ethnic Soft","Folk Art","Scandinavian Knit","Plaid Check","Stripe Collection","Woven Texture","Nursery Pattern","Block Print Textile","Soft Ikat","Tiny Icons Grid","Quilt Geometry","Handmade Textile","Neutral Fabric","Modern Folk","Cozy Knit","Primitive Motifs","Simple Weave","Ditsy Textile","Calm Linen"],
  "Seasonal": ["Christmas Botanical","Halloween Cute","Easter Spring","Thanksgiving Harvest","Valentine Minimal","Summer Vacation","Spring Garden","Autumn Harvest","Winter Cozy","New Year Celebration","Rainy Day","Back To School","Beach Icons","Snowflake Minimal","Pumpkin Patch","Festive Greenery","Holiday Ornaments","Spring Meadow","Fall Leaves","Cozy Cabin"],
  "Commercial Best Seller": ["Cute Animals","Baby Pattern","Kitchen Icons","Coffee Theme","Wellness Theme","Fitness Icons","School Elements","Travel Icons","Food Pattern","Nature Symbols","Pet Lover","Bakery Pattern","Farmhouse Icons","Spa Botanical","Camping Icons","Ocean Life","Fruit Market","Minimal Hearts","Cloud Stars","Hand Drawn Essentials"]
};
const THEME_DATA = {};
Object.entries(THEME_LIBRARY).forEach(([cat, arr])=>arr.forEach((name,i)=>{
  THEME_DATA[name] = {
    category: cat,
    theme: name,
    promptHint: `${name} seamless vector pattern in ${cat.toLowerCase()} category, flat clean editable vector, commercial stock style`,
    elementsHint: ["hero motif","medium supporting motif","small filler","tiny accent","organic spacing","balanced repeat"],
    palette: i%3===0 ? ["#D8C7AE","#A8B08C","#7B8453","#F3EBDD","#C98A6A"] : i%3===1 ? ["#F6EEE3","#B9B08F","#707C58","#D9A384","#2E352F"] : ["#EFE7D8","#AFC4AA","#6F8C69","#D7BFA6","#8B5E4A"]
  }
}));
