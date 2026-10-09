import type { Filter } from 'mongodb'
import type { PipelineStage } from 'mongoose'

import { Logger, NotFoundException } from '@nestjs/common'

import { Model, Types, UpdateQuery } from 'mongoose'

import { AbstractDoc } from '../schemas/abstract.schema'

/**
 * 从 Model 方法中推导出来的 Query 类型
 * 永远与当前 Mongoose 版本保持一致
 */
type ModelFilter<T> = Filter<T>

export abstract class AbstractDao<TDocument extends AbstractDoc> {
  protected abstract readonly logger: Logger

  protected constructor(protected readonly model: Model<TDocument>) {}

  async create(document: TDocument): Promise<TDocument> {
    const createDocument = new this.model(document)
    return (await createDocument.save()).toJSON() as TDocument
  }

  async findOne(filterQuery: ModelFilter<TDocument>): Promise<TDocument> {
    const query = this.handleIdInQuery(filterQuery)

    const document = await this.model.findOne(query, {}, { lean: true }).exec()

    if (!document) {
      this.logger.warn('Document not found with filterQuery', query)
      throw new NotFoundException('Mongo Document not found.')
    }

    return document as TDocument
  }

  async findOneAndUpdate(filterQuery: ModelFilter<TDocument>, update: UpdateQuery<TDocument>): Promise<TDocument> {
    const query = this.handleIdInQuery(filterQuery)

    const document = await this.model
      .findOneAndUpdate(query, update, {
        new: true,
        lean: true,
        upsert: true
      })
      .exec()

    if (!document) {
      this.logger.warn('Document not found with filterQuery', query)
      throw new NotFoundException('Mongo Document not found.')
    }

    return document as TDocument
  }

  async find(filterQuery: ModelFilter<TDocument>): Promise<TDocument[]> {
    const query = this.handleIdInQuery(filterQuery)

    const documents = await this.model.find(query, {}, { lean: true }).exec()

    return documents as TDocument[]
  }

  async deleteOne(filterQuery: ModelFilter<TDocument>): Promise<boolean> {
    const query = this.handleIdInQuery(filterQuery)

    const result = await this.model.deleteOne(query).exec()

    if (result.deletedCount === 0) {
      this.logger.warn('No document found to delete with filterQuery', query)
      return false
    }

    return true
  }

  async deleteMany(filterQuery: ModelFilter<TDocument>): Promise<number> {
    const query = this.handleIdInQuery(filterQuery)

    const result = await this.model.deleteMany(query).exec()

    if (result.deletedCount === 0) {
      this.logger.warn('No documents found to delete with filterQuery', query)
      return 0
    }

    return result.deletedCount
  }

  async aggregate<T = unknown>(pipeline: PipelineStage[]): Promise<T[]> {
    return this.model.aggregate<T>(pipeline).exec()
  }

  private handleIdInQuery(query: ModelFilter<TDocument>): ModelFilter<TDocument> {
    const id = query._id
    if (typeof id === 'string') {
      return { ...query, _id: new Types.ObjectId(id) }
    }
    return query
  }
}
