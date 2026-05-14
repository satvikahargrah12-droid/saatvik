import { pgTable, serial, integer, decimal, varchar, timestamp, date, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { deliveryAreasTable } from "./deliveryAreas";
import { productsTable } from "./products";
import { snacksTable } from "./snacks";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  fulfillmentType: varchar("fulfillment_type", { length: 20 }).notNull().default("DELIVERY"),
  deliveryAreaId: integer("delivery_area_id").references(() => deliveryAreasTable.id),
  /** Full street / landmark address for delivery (null for take-away or dine-in). */
  deliveryAddress: text("delivery_address"),
  deliveryCharge: decimal("delivery_charge", { precision: 10, scale: 2 }).notNull().default("0"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default("0"),
  status: varchar("status", { length: 50 }).default("pending"),
  paymentMethod: varchar("payment_method", { length: 20 }),
  /**
   * Online / recorded payment state (independent of fulfilment `status`).
   * PENDING — not yet paid or awaiting Razorpay; SUCCESS — paid or COD confirmed; FAILED — Razorpay failed or signature invalid.
   */
  paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("PENDING"),
  /** Razorpay payment_id after successful verification (API field name: paymentId). */
  razorpayPaymentId: varchar("razorpay_payment_id", { length: 100 }),
  /** Razorpay order_id used for checkout (API field name: orderId from provider). */
  razorpayOrderId: varchar("razorpay_order_id", { length: 100 }),
  orderTime: timestamp("order_time", { withTimezone: true }).defaultNow(),
  deliveryDate: date("delivery_date"),
});

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => ordersTable.id),
  productId: integer("product_id").references(() => productsTable.id),
  snackId: integer("snack_id").references(() => snacksTable.id),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, orderTime: true });
export const insertOrderItemSchema = createInsertSchema(orderItemsTable).omit({ id: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;
