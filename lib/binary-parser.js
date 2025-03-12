export class BinaryParser {
  constructor() {
    this.schema = [];
  }

  string(fieldName, options) {
    this.schema.push({type: 'string', fieldName, ...options});
    return this;
  }

  int(fieldName, options) {
    this.schema.push({type: 'int', fieldName, ...options});
    return this;
  }

  buffer(fieldName, options) {
    this.schema.push({type: 'buffer', fieldName, ...options});
    return this;
  }

  array(fieldName, options) {
    this.schema.push({type: 'array', fieldName, ...options});
    return this;
  }

  parse(buffer, parentContext) {
    const view = new DataView(buffer.buffer);
    let offset = 0;
    const context = {};
    context.$parent = parentContext;
    context.size = () => offset;

    const readString = length => {
      const value = new TextDecoder().decode(
        buffer.slice(offset, offset + length)
      );
      offset += length;
      return value;
    };

    const readInt = length => {
      const value = parseInt(readString(length), 10);
      return isNaN(value) ? 0 : value;
    };

    const readBuffer = readUntil => {
      const startOffset = offset;
      while(offset < buffer.byteLength) {
        const byte = view.getUint8(offset);
        if(readUntil(byte, context)) {
          break;
        }
        offset++;
      }
      const value = buffer.slice(startOffset, offset);
      offset++; // Skip the terminator byte
      return value;
    };

    for(const field of this.schema) {
      if(field.type === 'string') {
        const value = readString(field.length);
        context[field.fieldName] = field.formatter ?
          field.formatter(value) : value;
      } else if(field.type === 'int') {
        context[field.fieldName] = readInt(field.length);
      } else if(field.type === 'buffer') {
        context[field.fieldName] = readBuffer(field.readUntil);
      } else if(field.type === 'array') {
        const arrayLength = typeof field.length === 'string' ?
          context[field.length] : field.length;
        const subParser = field.parser;
        Object.assign(subParser, field.type);

        context[field.fieldName] = [];
        for(let i = 0; i < arrayLength; i++) {
          const subItem = subParser.parse(buffer.slice(offset), context);
          offset += subItem.size();

          delete subItem.size;
          delete subItem.$parent;

          context[field.fieldName].push(subItem);
        }
      }
    }

    if(!parentContext) {
      delete context.$parent;
      delete context.size;
    }

    return context;
  }
}
