import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret: any) => {
      ret.id = ret._id?.toString() || ret.id;
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
    transform: (doc, ret: any) => {
      ret.id = ret._id?.toString() || ret.id;
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      return ret;
    },
  },
})
export class User {
  @Prop({ unique: true, required: true, trim: true, lowercase: true })
  username!: string;

  @Prop({ required: false, select: false }) // Password is optional for OAuth users
  password?: string;

  @Prop({ unique: true, required: true, trim: true, lowercase: true })
  email!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ unique: true, sparse: true }) // sparse allows multiple nulls if not logged via google
  googleId?: string;

  @Prop({ type: [String], default: ['user'] })
  globalRoles!: string[];

  @Prop({ default: true })
  isActive!: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
