import { getItemById, type ItemId } from '../data/items';

export type InventorySlot = {
  itemId: ItemId | null;
  quantity: number;
};

export type InventorySnapshot = {
  slots: InventorySlot[];
  selectedSlotIndex: number;
};

export const hotbarSlotCount = 8;

export class InventorySystem {
  readonly slots: InventorySlot[];
  selectedSlotIndex = 0;

  private changeCallbacks: Array<() => void> = [];

  constructor(capacity = 24) {
    this.slots = Array.from({ length: capacity }, () => ({
      itemId: null,
      quantity: 0,
    }));
  }

  selectSlot(index: number) {
    if (!Number.isInteger(index) || index < 0 || index >= Math.min(hotbarSlotCount, this.slots.length)) {
      return;
    }

    this.selectedSlotIndex = index;
    this.notifyChange();
  }

  getSelectedSlot() {
    return this.slots[this.selectedSlotIndex];
  }

  addItem(itemId: ItemId, quantity = 1) {
    if (!this.canAdd(itemId, quantity)) return false;
    const maxStack = getItemById(itemId).maxStack;
    let remaining = quantity;

    for (const slot of this.slots) {
      if (slot.itemId !== itemId || slot.quantity >= maxStack) {
        continue;
      }

      const moved = Math.min(remaining, maxStack - slot.quantity);
      slot.quantity += moved;
      remaining -= moved;

      if (remaining === 0) {
        this.notifyChange();
        return true;
      }
    }

    for (const slot of this.slots) {
      if (slot.itemId !== null) {
        continue;
      }

      const moved = Math.min(remaining, maxStack);
      slot.itemId = itemId;
      slot.quantity = moved;
      remaining -= moved;

      if (remaining === 0) {
        this.notifyChange();
        return true;
      }
    }

    this.notifyChange();
    return false;
  }

  canAdd(itemId: ItemId, quantity: number) {
    const max = getItemById(itemId).maxStack;
    return Number.isInteger(quantity) && quantity > 0 && this.slots.reduce((n, slot) =>
      n + (slot.itemId === null ? max : slot.itemId === itemId ? max - slot.quantity : 0), 0) >= quantity;
  }

  transferTo(index: number, destination: InventorySystem) {
    const slot = this.slots[index];
    if (!slot?.itemId || destination === this || !destination.addItem(slot.itemId, slot.quantity)) return false;
    slot.itemId = null;
    slot.quantity = 0;
    this.notifyChange();
    return true;
  }

  swapSlots(from: number, to: number) {
    if (!this.slots[from] || !this.slots[to]) return;
    [this.slots[from], this.slots[to]] = [this.slots[to], this.slots[from]];
    this.notifyChange();
  }

  removeOneFromSelectedSlot() {
    const slot = this.getSelectedSlot();

    if (!slot.itemId || slot.quantity === 0) {
      return false;
    }

    slot.quantity--;

    if (slot.quantity === 0) {
      slot.itemId = null;
    }

    this.notifyChange();
    return true;
  }

  removeOneItem(itemId: ItemId) {
    const slot = this.slots.find((savedSlot) => savedSlot.itemId === itemId && savedSlot.quantity > 0);

    if (!slot) {
      return false;
    }

    slot.quantity--;

    if (slot.quantity === 0) {
      slot.itemId = null;
    }

    this.notifyChange();
    return true;
  }

  getItemCount(itemId: ItemId) {
    return this.slots.reduce((total, slot) => total + (slot.itemId === itemId ? slot.quantity : 0), 0);
  }

  hasItems(items: Array<{ itemId: ItemId; quantity: number }>) {
    return items.every((item) => this.getItemCount(item.itemId) >= item.quantity);
  }

  removeItems(items: Array<{ itemId: ItemId; quantity: number }>) {
    if (!this.hasItems(items)) {
      return false;
    }

    items.forEach((item) => {
      for (let index = 0; index < item.quantity; index++) {
        this.removeOneItem(item.itemId);
      }
    });
    return true;
  }

  getSnapshot(): InventorySnapshot {
    return {
      slots: this.slots.map((slot) => ({ ...slot })),
      selectedSlotIndex: this.selectedSlotIndex,
    };
  }

  loadSnapshot(snapshot: InventorySnapshot) {
    this.slots.forEach(slot => { slot.itemId = null; slot.quantity = 0; });
    snapshot.slots.forEach((slot, index) => {
      if (!this.slots[index]) {
        return;
      }

      this.slots[index].itemId = slot.itemId;
      this.slots[index].quantity = slot.quantity;
    });
    this.selectedSlotIndex = Math.min(Math.max(snapshot.selectedSlotIndex, 0), hotbarSlotCount - 1);
    this.notifyChange();
  }

  onChange(callback: () => void) {
    this.changeCallbacks.push(callback);
    return () => {
      this.changeCallbacks = this.changeCallbacks.filter((saved) => saved !== callback);
    };
  }

  private notifyChange() {
    this.changeCallbacks.forEach((callback) => callback());
  }
}
