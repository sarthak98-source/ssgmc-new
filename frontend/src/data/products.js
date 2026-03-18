export const categories = [
  { id: 'clothing',    label: 'Clothing',     icon: '👗', arMode: 'body' },
  { id: 'jewelry',     label: 'Jewelry',      icon: '💍', arMode: 'face' },
  { id: 'glasses',     label: 'Glasses',      icon: '🕶️', arMode: 'face' },
  { id: 'hats',        label: 'Hats',         icon: '🎩', arMode: 'face' },
  { id: 'shoes',       label: 'Shoes',        icon: '👟', arMode: 'body' },
  { id: 'furniture',   label: 'Furniture',    icon: '🛋️', arMode: 'room' },
  { id: 'electronics', label: 'Electronics',  icon: '📱', arMode: '3d'   },
  { id: 'home-decor',  label: 'Home Decor',   icon: '🏠', arMode: 'room' },
]

export const products = [
  { id:1,  name:'Luxe Silk Blazer',       category:'clothing',    arMode:'body', price:12999,  originalPrice:18999, image:'https://images.unsplash.com/photo-1594938298603-c8148c4b4571?w=500&q=80', rating:4.8, reviews:124, badge:'AR Try-On',   colors:['#1a1a1a','#8B7355','#2c4a7c'], sizes:['S','M','L','XL'],      featured:true,  seller:'FashionHouse', sellerId:2 },
  { id:2,  name:'Diamond Halo Ring',      category:'jewelry',     arMode:'face', price:45999,  originalPrice:65000, image:'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=500&q=80', rating:4.9, reviews:89,  badge:'Best Seller', colors:['#C0C0C0','#FFD700'],           sizes:['5','6','7','8'],        featured:true,  seller:'GemCraft',     sellerId:2 },
  { id:3,  name:'Aviator Pro Sunglasses', category:'glasses',     arMode:'face', price:5999,   originalPrice:8999,  image:'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500&q=80', rating:4.7, reviews:203, badge:'AR Try-On',   colors:['#1a1a1a','#FFD700'],           sizes:['One Size'],             featured:true,  seller:'EyeStyle',     sellerId:2 },
  { id:4,  name:'Velvet Bucket Hat',      category:'hats',        arMode:'face', price:2499,   originalPrice:3999,  image:'https://images.unsplash.com/photo-1514327605112-b887c0e61c0a?w=500&q=80', rating:4.5, reviews:67,  badge:'New',         colors:['#1a1a1a','#8B0000'],           sizes:['S/M','L/XL'],           featured:false, seller:'HatWorks',     sellerId:2 },
  { id:5,  name:'Moderno Sofa',           category:'furniture',   arMode:'room', price:89999,  originalPrice:129999,image:'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500&q=80', rating:4.6, reviews:45,  badge:'AR Place',    colors:['#E8DCC8','#1a1a1a'],           sizes:['2-Seat','3-Seat'],      featured:true,  seller:'HomeLux',      sellerId:2 },
  { id:6,  name:'iPhone 15 Pro Max',      category:'electronics', arMode:'3d',   price:134900, originalPrice:149900,image:'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500&q=80', rating:4.9, reviews:512, badge:'3D View',     colors:['#E5CDBB','#1a1a1a'],           sizes:['256GB','512GB'],        featured:true,  seller:'TechZone',     sellerId:2 },
  { id:7,  name:'Embroidered Maxi Dress', category:'clothing',    arMode:'body', price:7499,   originalPrice:12000, image:'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=500&q=80', rating:4.7, reviews:98,  badge:'AR Try-On',   colors:['#F5F0E8','#8B0000'],           sizes:['XS','S','M','L','XL'],  featured:false, seller:'FashionHouse', sellerId:2 },
  { id:8,  name:'Marble Table Lamp',      category:'home-decor',  arMode:'room', price:8999,   originalPrice:14999, image:'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500&q=80', rating:4.4, reviews:33,  badge:'AR Place',    colors:['#F5F5F5','#1a1a1a'],           sizes:['Small','Large'],        featured:false, seller:'HomeLux',      sellerId:2 },
  { id:9,  name:'MacBook Pro 14"',        category:'electronics', arMode:'3d',   price:199900, originalPrice:219900,image:'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&q=80', rating:4.9, reviews:278, badge:'3D View',     colors:['#C0C0C0','#1a1a1a'],           sizes:['18GB','36GB'],          featured:false, seller:'TechZone',     sellerId:2 },
  { id:10, name:'Pearl Drop Earrings',    category:'jewelry',     arMode:'face', price:3999,   originalPrice:6500,  image:'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=500&q=80', rating:4.6, reviews:156, badge:'AR Try-On',   colors:['#F5F5F5','#FFD700'],           sizes:['One Size'],             featured:false, seller:'GemCraft',     sellerId:2 },
  { id:11, name:'Leather Oxford Shoes',   category:'shoes',       arMode:'body', price:14999,  originalPrice:22000, image:'https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=500&q=80', rating:4.8, reviews:87,  badge:'AR Try-On',   colors:['#2c1810','#1a1a1a'],           sizes:['7','8','9','10','11'], featured:false, seller:'SoleKraft',    sellerId:2 },
  { id:12, name:'Walnut Dining Chair',    category:'furniture',   arMode:'room', price:24999,  originalPrice:35000, image:'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=500&q=80', rating:4.5, reviews:29,  badge:'AR Place',    colors:['#6B4226','#1a1a1a'],           sizes:['Single','Set of 2'],    featured:false, seller:'HomeLux',      sellerId:2 },
]

export const getProductById       = id  => products.find(p => p.id === parseInt(id))
export const getProductsByCategory = cat => products.filter(p => p.category === cat)
export const getFeatured           = ()  => products.filter(p => p.featured)
