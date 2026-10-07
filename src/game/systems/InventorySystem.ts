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

  constructor() {
    this.slots = Array.from({ length: hotbarSlotCount }, () => ({
      itemId: null,
      quantity: 0,
    }));
  }

  selectSlot(index: number) {
    if (index < 0 || index >= this.slots.length) {
      return;
    }

    this.selectedSlotIndex = index;
    this.notifyChange();
  }

  getSelectedSlot() {
    return this.slots[this.selectedSlotIndex];
  }

  addItem(itemId: ItemId, quantity = 1) {
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

  getSnapshot(): InventorySnapshot {
    return {
      slots: this.slots.map((slot) => ({ ...slot })),
      selectedSlotIndex: this.selectedSlotIndex,
    };
  }

  loadSnapshot(snapshot: InventorySnapshot) {
    snapshot.slots.forEach((slot, index) => {
      if (!this.slots[index]) {
        return;
      }

      this.slots[index].itemId = slot.itemId;
      this.slots[index].quantity = slot.quantity;
    });
    this.selectedSlotIndex = snapshot.selectedSlotIndex;
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
