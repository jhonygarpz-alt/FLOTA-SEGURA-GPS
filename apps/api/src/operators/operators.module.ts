import { Module } from '@nestjs/common';
import { OperatorsController } from './operators.controller';

@Module({ controllers: [OperatorsController] })
export class OperatorsModule {}
