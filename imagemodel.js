const mongoose =require("mongoose")


const carouselSchema=mongoose.Schema(
    {
    
        carouselImage:{
            type:Buffer
          },
    },
    {
        timestamps:true
    }
)
carouselSchema.methods.toJSON = function () {
    const carousel = this;
    const carouselObject = carousel.toObject();
    delete carouselObject.carouselImage;
    return carouselObject ;
  };

const Carousel=mongoose.model("Carousel",carouselSchema);
module.exports=Carousel;