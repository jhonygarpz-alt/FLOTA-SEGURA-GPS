import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { PlansController } from './plans.controller';

@Module({ controllers: [CompaniesController, PlansController] })
export class CompaniesModule {}
