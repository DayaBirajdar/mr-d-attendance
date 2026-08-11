import inventoryData from "../../data/inventoryData";

function InventoryCards() {
  const totalItems = inventoryData.length;

  const electronics = inventoryData.filter(
    (item) => item.category === "Electronics"
  ).length;

  const inUse = inventoryData.filter(
    (item) => item.status === "In Use"
  ).length;

  const available = inventoryData.filter(
    (item) => item.status === "Available"
  ).length;

  return (
    <div className="cards-container">

      <div className="info-card">
        <h4>📦 Total Items</h4>
        <h2>{totalItems}</h2>
      </div>

      <div className="info-card">
        <h4>💻 Electronics</h4>
        <h2>{electronics}</h2>
      </div>

      <div className="info-card">
        <h4>🟢 Available</h4>
        <h2>{available}</h2>
      </div>

      <div className="info-card">
        <h4>👤 In Use</h4>
        <h2>{inUse}</h2>
      </div>

    </div>
  );
}

export default InventoryCards;