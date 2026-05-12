export class RichTextCreatedEvent {
  constructor(
    public readonly itemId: string,
    public readonly rawContent: string
  ) {}
}
