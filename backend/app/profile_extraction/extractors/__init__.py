from .numeric import number_with_unit
from .axes import axis_count, linear_axes
from .units import programming_units
from .text import labeled_text

EXTRACTORS = {
    "number_with_unit": number_with_unit,
    "axis_count": axis_count,
    "linear_axes": linear_axes,
    "programming_units": programming_units,
    "labeled_text": labeled_text,
}
