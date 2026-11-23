const zone = "America/Lima";
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
});
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: zone, hourCycle: "h23", hour: "2-digit", minute: "2-digit",
});

export function limaDate(value: Date | string = new Date()) {
  return dateFormatter.format(new Date(value));
}

export function limaTime(value: Date | string) {
  return timeFormatter.format(new Date(value));
}

export function validDate(value: string) {
  const parsed = Date.parse(value + "T12:00:00Z");
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(parsed)
    && new Date(parsed).toISOString().slice(0, 10) === value
    && value >= "1900-01-01" && value <= "2100-12-31";
}

export function validTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function atLima(date: string, time = "00:00") {
  return new Date(date + "T" + time + ":00-05:00");
}

export function addDays(date: string, count: number) {
  return new Date(atLima(date).getTime() + count * 86_400_000).toISOString().slice(0, 10);
}

export function demoDay() {
  const today = limaDate();
  const tomorrow = addDays(today, 1);
  return atLima(tomorrow).getUTCDay() === 0 ? addDays(tomorrow, 1) : tomorrow;
}
