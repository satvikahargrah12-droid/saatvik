import { Router, type IRouter } from "express";
import { eq, sql, and, gte } from "drizzle-orm";
import { db, ordersTable, usersTable, productsTable, deliveryAreasTable, orderItemsTable, categoriesTable } from "@workspace/db";
import { authenticate, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/admin/dashboard", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [todayOrdersRes] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(gte(ordersTable.orderTime, todayStart));
  const [pendingRes] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(eq(ordersTable.status, "pending"));
  const [deliveredRes] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(and(eq(ordersTable.status, "delivered"), gte(ordersTable.orderTime, todayStart)));
  const [revenueRes] = await db.select({ total: sql<string>`coalesce(sum(total), 0)::text` }).from(ordersTable).where(gte(ordersTable.orderTime, todayStart));
  const [customersRes] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(and(eq(usersTable.status, 1), eq(usersTable.role, "user")));
  const [menuRes] = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(eq(productsTable.status, 1));

  const recentOrders = await db
    .select({
      id: ordersTable.id,
      user_id: ordersTable.userId,
      customer_name: usersTable.name,
      customer_phone: usersTable.phone,
      delivery_area_id: ordersTable.deliveryAreaId,
      delivery_area_name: deliveryAreasTable.name,
      delivery_charge: ordersTable.deliveryCharge,
      subtotal: ordersTable.subtotal,
      total: ordersTable.total,
      status: ordersTable.status,
      payment_method: ordersTable.paymentMethod,
      order_time: ordersTable.orderTime,
      delivery_date: ordersTable.deliveryDate,
      delivery_address: ordersTable.deliveryAddress,
    })
    .from(ordersTable)
    .leftJoin(usersTable, eq(ordersTable.userId, usersTable.id))
    .leftJoin(deliveryAreasTable, eq(ordersTable.deliveryAreaId, deliveryAreasTable.id))
    .orderBy(sql`${ordersTable.orderTime} desc`)
    .limit(10);

  const recentWithItems = await Promise.all(recentOrders.map(async (order) => {
    const items = await db
      .select({ id: orderItemsTable.id, order_id: orderItemsTable.orderId, product_id: orderItemsTable.productId, quantity: orderItemsTable.quantity, price: orderItemsTable.price, product_name: productsTable.name })
      .from(orderItemsTable)
      .leftJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
      .where(eq(orderItemsTable.orderId, order.id));
    return { ...order, items };
  }));

  res.json({
    today_orders: todayOrdersRes.count,
    pending_orders: pendingRes.count,
    delivered_today: deliveredRes.count,
    revenue_today: revenueRes.total || "0",
    active_customers: customersRes.count,
    menu_items: menuRes.count,
    recent_orders: recentWithItems,
  });
});

router.get("/admin/dashboard/weekly-revenue", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    const [rev] = await db.select({ total: sql<string>`coalesce(sum(total), 0)::text`, orders: sql<number>`count(*)::int` })
      .from(ordersTable)
      .where(and(gte(ordersTable.orderTime, day), sql`${ordersTable.orderTime} < ${nextDay}`));
    result.push({ day: days[day.getDay() === 0 ? 6 : day.getDay() - 1], revenue: rev.total || "0", orders: rev.orders });
  }
  res.json(result);
});

router.get("/admin/dashboard/orders-by-category", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      category_name: categoriesTable.name,
      count: sql<number>`count(*)::int`,
    })
    .from(orderItemsTable)
    .leftJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .groupBy(categoriesTable.name);

  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  const result = rows.map(r => ({ category_name: r.category_name || "Unknown", count: r.count, percentage: Math.round((r.count / total) * 100) }));
  res.json(result);
});

export default router;
