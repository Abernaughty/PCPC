import { Container, CosmosClient } from "@azure/cosmos";
import {
  SetMapping,
  SetMappingMetadata,
  SetMatchType,
} from "../models/SetMapping";

const DEFAULT_DATABASE_NAME = "PokemonCards";
const DEFAULT_CONTAINER_NAME = "SetMappings";
const METADATA_ID = "__metadata__";

/**
 * Partition Key Strategy:
 * - Partition key path: /id
 * - Partition key value: String representation of pokeDataSetId
 * - This ensures even distribution and efficient queries by set ID
 * - Metadata document uses its own ID as partition key
 */
const PARTITION_KEY_PATH = "/id";

interface SetMappingDocument extends SetMapping {
  documentType: "setMapping";
}

interface SetMappingMetadataDocument extends SetMappingMetadata {
  documentType: "metadata";
}

export class SetMappingRepository {
  private container: Container;

  constructor(connectionString: string) {
    const databaseName =
      process.env.COSMOS_DB_DATABASE_NAME || DEFAULT_DATABASE_NAME;
    const containerName =
      process.env.COSMOS_DB_SET_MAPPINGS_CONTAINER_NAME ||
      DEFAULT_CONTAINER_NAME;

    const client = new CosmosClient(connectionString);
    const database = client.database(databaseName);
    this.container = database.container(containerName);
  }

  private toSetMapping(document: SetMappingDocument): SetMapping {
    const { documentType, ...mapping } = document;
    return mapping;
  }

  private toMetadata(document: SetMappingMetadataDocument): SetMappingMetadata {
    const { documentType, ...metadata } = document;
    return metadata;
  }

  /**
   * Get a mapping by PokeData set ID
   * Uses the partition key for efficient lookup
   */
  async getMappingByPokeDataSetId(
    pokeDataSetId: number
  ): Promise<SetMapping | null> {
    const id = String(pokeDataSetId);

    try {
      // Partition key must match the document ID for our strategy
      const { resource } = await this.container.item(id, id).read<any>();
      if (!resource || resource.documentType !== "setMapping") {
        return null;
      }
      return this.toSetMapping(resource as unknown as SetMappingDocument);
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * List all set mappings
   * Note: This is a cross-partition query and may be expensive for large datasets
   */
  async listMappings(): Promise<SetMapping[]> {
    const query = {
      query: "SELECT * FROM c WHERE c.documentType = @type",
      parameters: [{ name: "@type", value: "setMapping" }],
    };
    const { resources } = await this.container.items
      .query<any>(query)
      .fetchAll();
    return resources
      .filter((doc: any) => doc.documentType === "setMapping")
      .map((doc: any) =>
        this.toSetMapping(doc as unknown as SetMappingDocument)
      );
  }

  /**
   * Upsert a set mapping
   * Ensures id matches pokeDataSetId for partition key consistency
   */
  async upsertMapping(
    mapping: Omit<SetMapping, "id" | "createdAt" | "updatedAt"> & {
      id?: string;
      createdAt?: string;
      updatedAt?: string;
      matchType?: SetMatchType;
    }
  ): Promise<SetMapping> {
    const now = new Date().toISOString();
    const id = String(mapping.pokeDataSetId);

    // Validate that if id is provided, it matches pokeDataSetId
    if (mapping.id && mapping.id !== id) {
      throw new Error(
        `Mapping id (${mapping.id}) must match pokeDataSetId (${id}) for partition key consistency`
      );
    }

    const existing = await this.getMappingByPokeDataSetId(
      mapping.pokeDataSetId
    );

    const matchType: SetMatchType =
      (mapping.matchType as SetMatchType) || existing?.matchType || "automatic";

    const status =
      mapping.status ||
      existing?.status ||
      (mapping.tcgSetId ? "active" : "unmatched");

    const document: SetMappingDocument = {
      id,
      documentType: "setMapping",
      pokeDataSetId: mapping.pokeDataSetId,
      pokeDataSetCode: mapping.pokeDataSetCode ?? null,
      pokeDataSetName: mapping.pokeDataSetName,
      tcgSetId: mapping.tcgSetId ?? null,
      tcgSetName: mapping.tcgSetName ?? null,
      matchType,
      confidence: mapping.confidence ?? existing?.confidence ?? 0,
      status,
      createdAt: existing?.createdAt || mapping.createdAt || now,
      updatedAt: now,
      metadata: mapping.metadata || existing?.metadata,
    };

    const { resource } = await this.container.items.upsert(document);
    return resource
      ? this.toSetMapping(resource as unknown as SetMappingDocument)
      : this.toSetMapping(document);
  }

  /**
   * Get mapping metadata
   */
  async getMetadata(): Promise<SetMappingMetadata | null> {
    try {
      const { resource } = await this.container
        .item(METADATA_ID, METADATA_ID)
        .read<any>();
      if (!resource || resource.documentType !== "metadata") {
        return null;
      }
      return this.toMetadata(resource);
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Upsert mapping metadata
   */
  async upsertMetadata(
    metadata: Partial<Omit<SetMappingMetadata, "id" | "documentType">>
  ): Promise<SetMappingMetadata> {
    const existing = await this.getMetadata();
    const now = new Date().toISOString();

    const document: SetMappingMetadataDocument = {
      id: METADATA_ID,
      documentType: "metadata",
      lastPokeDataSetCount:
        metadata.lastPokeDataSetCount ?? existing?.lastPokeDataSetCount ?? 0,
      lastTcgSetCount:
        metadata.lastTcgSetCount ?? existing?.lastTcgSetCount ?? 0,
      lastRunAt: metadata.lastRunAt ?? existing?.lastRunAt ?? null,
      lastDiffDetectedAt:
        metadata.lastDiffDetectedAt ?? existing?.lastDiffDetectedAt ?? null,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    const { resource } = await this.container.items.upsert(document);
    return resource
      ? this.toMetadata(resource as unknown as SetMappingMetadataDocument)
      : this.toMetadata(document);
  }
}
