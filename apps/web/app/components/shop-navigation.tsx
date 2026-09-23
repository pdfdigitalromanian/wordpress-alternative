import { Link } from "react-router";
export function ShopNavigation() {
  return <nav className="shop-navigation" aria-label="Shop navigation"><Link to="/shop">Shop</Link><Link to="/cart">Your cart →</Link></nav>;
}
