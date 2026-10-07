export type TimeSnapshot = {
  day: number;
  hour: number;
  minute: number;
};

const dayDurationMs = 120000;
const morningHour = 7;
const minutesPerDay = 24 * 60;

export class TimeSystem {
  day = 1;
  hour = morningHour;
  minute = 0;

  private currentMinute = morningHour * 60;
  private lastUpdateTime: number | null = null;

  update(time: number) {
    if (this.lastUpdateTime === null) {
      this.lastUpdateTime = time;
      return false;
    }

    const previousDay = this.day;
    const elapsed = time - this.lastUpdateTime;
    this.lastUpdateTime = time;
    this.currentMinute += (elapsed / dayDurationMs) * minutesPerDay;

    while (this.currentMinute >= minutesPerDay) {
      this.currentMinute -= minutesPerDay;
      this.day++;
    }

    this.hour = Math.floor(this.currentMinute / 60);
    this.minute = Math.floor(this.currentMinute % 60);
    return this.day !== previousDay;
  }

  advanceDay() {
    this.day++;
    this.currentMinute = morningHour * 60;
    this.hour = morningHour;
    this.minute = 0;
    this.lastUpdateTime = null;
  }

  getSnapshot(): TimeSnapshot {
    return {
      day: this.day,
      hour: this.hour,
      minute: this.minute,
    };
  }

  loadSnapshot(snapshot: TimeSnapshot) {
    this.day = snapshot.day;
    this.hour = snapshot.hour;
    this.minute = snapshot.minute;
    this.currentMinute = snapshot.hour * 60 + snapshot.minute;
    this.lastUpdateTime = null;
  }
}
