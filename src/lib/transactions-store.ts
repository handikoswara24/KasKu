import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ObjectId, WithId } from "mongodb";
import { deleteReceiptFromImageKit } from "@/lib/imagekit";
import { getDatabase, isMongoConfigured } from "@/lib/mongodb";
import {
  CreateTransactionInput,
  StorageMode,
  TransactionRecord,
} from "@/types/finance";

const COLLECTION_NAME = "transactions";
const LOCAL_STORE_PATH = path.join("/tmp", "kasku-transactions.json");

interface MongoTransactionDoc {
  _id?: ObjectId;
  id?: string;
  username?: string;
  type: "income" | "expense";
  title: string;
  merchantName?: string;
  sourcePlatform?: string;
  serviceLabel?: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod: string;
  notes?: string;
  items?: TransactionRecord["items"];
  receiptPreviewUrl?: string;
  receiptFileId?: string;
  taxOrService?: number;
  discount?: number;
  createdAt: string;
  updatedAt: string;
}

let indexesEnsured = false;

async function getMongoCollection() {
  const db = await getDatabase();
  const collection = db.collection<MongoTransactionDoc>(COLLECTION_NAME);
  if (!indexesEnsured) {
    await Promise.all([
      collection.createIndex({ date: -1, createdAt: -1 }),
      collection.createIndex({ type: 1, date: -1 }),
    ]).catch(() => {
      // Index creation failure should not block operations on restricted roles
    });
    indexesEnsured = true;
  }
  return collection;
}

function sanitizeRemoteImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return trimmed;
  }
  return undefined;
}

function serializeMongoDoc(doc: WithId<MongoTransactionDoc>): TransactionRecord {
  return {
    id: doc._id.toHexString(),
    username: doc.username,
    type: doc.type,
    title: doc.title,
    merchantName: doc.merchantName,
    sourcePlatform: doc.sourcePlatform,
    serviceLabel: doc.serviceLabel,
    category: doc.category,
    amount: Number(doc.amount) || 0,
    date: doc.date,
    paymentMethod: doc.paymentMethod || "Lainnya",
    notes: doc.notes,
    items: Array.isArray(doc.items) ? doc.items : undefined,
    receiptPreviewUrl: doc.receiptPreviewUrl,
    receiptFileId: doc.receiptFileId,
    taxOrService: doc.taxOrService,
    discount: doc.discount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function readLocalStore(): Promise<TransactionRecord[]> {
  try {
    const raw = await fs.readFile(LOCAL_STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLocalStore(records: TransactionRecord[]): Promise<void> {
  await fs.writeFile(LOCAL_STORE_PATH, JSON.stringify(records, null, 2), "utf-8");
}

export async function listTransactions(filters?: {
  month?: string;
  type?: string;
  search?: string;
}): Promise<{ transactions: TransactionRecord[]; storageMode: StorageMode }> {
  let records: TransactionRecord[] = [];
  let storageMode: StorageMode = "local-fallback";

  if (isMongoConfigured()) {
    storageMode = "mongodb";
    const collection = await getMongoCollection();
    const query: Record<string, unknown> = {};

    if (filters?.month && /^\d{4}-\d{2}$/.test(filters.month)) {
      query.date = { $regex: `^${filters.month}` };
    }
    if (filters?.type === "income" || filters?.type === "expense") {
      query.type = filters.type;
    }

    const docs = await collection
      .find(query)
      .sort({ date: -1, createdAt: -1 })
      .toArray();

    records = docs.map(serializeMongoDoc);
  } else {
    records = await readLocalStore();
    if (filters?.month && /^\d{4}-\d{2}$/.test(filters.month)) {
      records = records.filter((item) => item.date.startsWith(filters.month!));
    }
    if (filters?.type === "income" || filters?.type === "expense") {
      records = records.filter((item) => item.type === filters.type);
    }
    records.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  if (filters?.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    records = records.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.username ?? "").toLowerCase().includes(q) ||
        (item.merchantName ?? "").toLowerCase().includes(q) ||
        (item.sourcePlatform ?? "").toLowerCase().includes(q) ||
        (item.serviceLabel ?? "").toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.notes ?? "").toLowerCase().includes(q) ||
        (item.items ?? []).some((sub) => sub.name.toLowerCase().includes(q))
    );
  }

  return { transactions: records, storageMode };
}

export async function createTransaction(
  input: CreateTransactionInput
): Promise<{ transaction: TransactionRecord; storageMode: StorageMode }> {
  const now = new Date().toISOString();
  const baseDoc: Omit<MongoTransactionDoc, "_id"> = {
    username: input.username?.trim() || undefined,
    type: input.type,
    title: input.title.trim(),
    merchantName: input.merchantName?.trim() || undefined,
    sourcePlatform: input.sourcePlatform?.trim() || undefined,
    serviceLabel: input.serviceLabel?.trim() || undefined,
    category: input.category.trim(),
    amount: Math.max(0, Math.round(Number(input.amount) || 0)),
    date: input.date,
    paymentMethod: input.paymentMethod.trim() || "Lainnya",
    notes: input.notes?.trim() || undefined,
    items: input.items && input.items.length > 0 ? input.items : undefined,
    receiptPreviewUrl: sanitizeRemoteImageUrl(input.receiptPreviewUrl),
    receiptFileId: input.receiptFileId?.trim() || undefined,
    taxOrService: input.taxOrService ? Math.round(input.taxOrService) : undefined,
    discount: input.discount ? Math.round(input.discount) : undefined,
    createdAt: now,
    updatedAt: now,
  };

  if (isMongoConfigured()) {
    const collection = await getMongoCollection();
    const result = await collection.insertOne(baseDoc);
    const created: TransactionRecord = {
      id: result.insertedId.toHexString(),
      ...baseDoc,
    };
    return { transaction: created, storageMode: "mongodb" };
  }

  const records = await readLocalStore();
  const created: TransactionRecord = {
    id: crypto.randomUUID(),
    ...baseDoc,
  };
  records.unshift(created);
  await writeLocalStore(records);
  return { transaction: created, storageMode: "local-fallback" };
}

export async function deleteTransaction(
  id: string
): Promise<{ deleted: boolean; storageMode: StorageMode }> {
  if (isMongoConfigured()) {
    if (!ObjectId.isValid(id)) {
      return { deleted: false, storageMode: "mongodb" };
    }
    const collection = await getMongoCollection();
    const removed = await collection.findOneAndDelete({
      _id: new ObjectId(id),
    });
    if (!removed) {
      return { deleted: false, storageMode: "mongodb" };
    }
    if (removed.receiptFileId) {
      await deleteReceiptFromImageKit(removed.receiptFileId);
    }
    return { deleted: true, storageMode: "mongodb" };
  }

  const records = await readLocalStore();
  const target = records.find((r) => r.id === id);
  if (!target) {
    return { deleted: false, storageMode: "local-fallback" };
  }
  const next = records.filter((r) => r.id !== id);
  await writeLocalStore(next);
  if (target.receiptFileId) {
    await deleteReceiptFromImageKit(target.receiptFileId);
  }
  return { deleted: true, storageMode: "local-fallback" };
}

export async function updateTransaction(
  id: string,
  updates: Partial<CreateTransactionInput>
): Promise<{ transaction: TransactionRecord | null; storageMode: StorageMode }> {
  const now = new Date().toISOString();

  if (isMongoConfigured()) {
    if (!ObjectId.isValid(id)) {
      return { transaction: null, storageMode: "mongodb" };
    }
    const collection = await getMongoCollection();
    const $set: Record<string, unknown> = { updatedAt: now };
    if (updates.username !== undefined) $set.username = updates.username.trim() || undefined;
    if (updates.type) $set.type = updates.type;
    if (updates.title !== undefined) $set.title = updates.title.trim();
    if (updates.merchantName !== undefined) $set.merchantName = updates.merchantName.trim();
    if (updates.sourcePlatform !== undefined) $set.sourcePlatform = updates.sourcePlatform.trim();
    if (updates.serviceLabel !== undefined) $set.serviceLabel = updates.serviceLabel.trim();
    if (updates.category !== undefined) $set.category = updates.category.trim();
    if (updates.amount !== undefined) $set.amount = Math.max(0, Math.round(Number(updates.amount) || 0));
    if (updates.date !== undefined) $set.date = updates.date;
    if (updates.paymentMethod !== undefined) $set.paymentMethod = updates.paymentMethod.trim();
    if (updates.notes !== undefined) $set.notes = updates.notes.trim();
    if (updates.items !== undefined) $set.items = updates.items;

    const updated = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set },
      { returnDocument: "after" }
    );
    return {
      transaction: updated ? serializeMongoDoc(updated) : null,
      storageMode: "mongodb",
    };
  }

  const records = await readLocalStore();
  const index = records.findIndex((r) => r.id === id);
  if (index === -1) {
    return { transaction: null, storageMode: "local-fallback" };
  }
  const existing = records[index];
  const nextRecord: TransactionRecord = {
    ...existing,
    ...updates,
    receiptPreviewUrl:
      updates.receiptPreviewUrl !== undefined
        ? sanitizeRemoteImageUrl(updates.receiptPreviewUrl)
        : existing.receiptPreviewUrl,
    amount:
      updates.amount !== undefined
        ? Math.max(0, Math.round(Number(updates.amount) || 0))
        : existing.amount,
    updatedAt: now,
  };
  records[index] = nextRecord;
  await writeLocalStore(records);
  return { transaction: nextRecord, storageMode: "local-fallback" };
}
