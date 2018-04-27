import sys
from PIL import Image

rawData = open(sys.argv[1], 'rb').read()
imgSize = (int(sys.argv[3]), int(sys.argv[4]))
# Use the PIL raw decoder to read the data.
# the 'F;16' informs the raw decoder that we are reading
# a little endian, unsigned integer 16 bit data.
img = Image.frombytes('RGBA', imgSize, rawData, 'raw')
img.save(sys.argv[2])
