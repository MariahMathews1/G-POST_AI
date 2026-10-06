import { useLocation } from "react-router";
import { navigation } from "../../app/navigation";
export default function TopBar() {
  const { pathname } = useLocation();
  const title =
    navigation.find((item) => pathname.startsWith(item.to))?.label ?? "Creo NC";
  return (
    <header className="topbar">
      <span>{title}</span>
      <span className="environment">V2 R&D</span>
    </header>
  );
}
